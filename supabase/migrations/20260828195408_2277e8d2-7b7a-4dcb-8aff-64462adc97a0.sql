-- 1. Conta master (dono da empresa) de um usuário
CREATE OR REPLACE FUNCTION public.conta_master(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT m.criado_por
       FROM public.condominio_members m
      WHERE m.user_id = _user_id
        AND m.criado_por IS NOT NULL
        AND m.criado_por <> m.user_id
      ORDER BY m.created_at ASC
      LIMIT 1),
    _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.conta_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conta_master(uuid) TO authenticated, service_role;

-- 2. Backfill: todo condomínio de qualquer integrante da empresa passa a ser
--    acessível por todos os integrantes daquela empresa.
WITH pares AS (
  SELECT DISTINCT m.criado_por AS master, m.user_id AS membro
    FROM public.condominio_members m
   WHERE m.criado_por IS NOT NULL AND m.criado_por <> m.user_id
),
equipe AS (
  SELECT master, membro FROM pares
  UNION
  SELECT master, master FROM pares
),
condos AS (
  SELECT DISTINCT e.master, c.id AS condominio_id
    FROM equipe e
    JOIN public.condominios c ON c.owner_id = e.membro
)
INSERT INTO public.condominio_members (
  condominio_id, user_id, papel, criado_por,
  pode_gerenciar_contratos, pode_gerenciar_documentos,
  pode_gerenciar_assembleias, pode_gerenciar_unidades, pode_gerenciar_usuarios
)
SELECT cd.condominio_id,
       e.membro,
       (CASE WHEN e.membro = e.master THEN 'dono_condominio' ELSE 'operador_condominio' END)::public.papel_condo_v2,
       e.master,
       (e.membro = e.master), (e.membro = e.master),
       (e.membro = e.master), (e.membro = e.master), false
  FROM condos cd
  JOIN equipe e ON e.master = cd.master
 WHERE NOT EXISTS (
         SELECT 1 FROM public.condominio_members m2
          WHERE m2.condominio_id = cd.condominio_id AND m2.user_id = e.membro)
   AND NOT EXISTS (
         SELECT 1 FROM public.condominios c2
          WHERE c2.id = cd.condominio_id AND c2.owner_id = e.membro);

-- 3. Novos condomínios são compartilhados automaticamente com a empresa
CREATE OR REPLACE FUNCTION public.tg_condominio_compartilhar_equipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master uuid;
BEGIN
  v_master := public.conta_master(NEW.owner_id);

  INSERT INTO public.condominio_members (
    condominio_id, user_id, papel, criado_por,
    pode_gerenciar_contratos, pode_gerenciar_documentos,
    pode_gerenciar_assembleias, pode_gerenciar_unidades, pode_gerenciar_usuarios
  )
  SELECT NEW.id,
         u.user_id,
         (CASE WHEN u.user_id = v_master THEN 'dono_condominio' ELSE 'operador_condominio' END)::public.papel_condo_v2,
         v_master,
         (u.user_id = v_master), (u.user_id = v_master),
         (u.user_id = v_master), (u.user_id = v_master), false
    FROM (
      SELECT v_master AS user_id
      UNION
      SELECT DISTINCT m.user_id
        FROM public.condominio_members m
       WHERE m.criado_por = v_master AND m.user_id <> v_master
    ) u
   WHERE u.user_id <> NEW.owner_id
     AND NOT EXISTS (
       SELECT 1 FROM public.condominio_members m2
        WHERE m2.condominio_id = NEW.id AND m2.user_id = u.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_condominio_compartilhar_equipe ON public.condominios;
CREATE TRIGGER trg_condominio_compartilhar_equipe
AFTER INSERT ON public.condominios
FOR EACH ROW EXECUTE FUNCTION public.tg_condominio_compartilhar_equipe();