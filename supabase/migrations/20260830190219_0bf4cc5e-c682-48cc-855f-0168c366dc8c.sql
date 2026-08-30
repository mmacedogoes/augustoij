-- Conta dona (ambiente) de um condomínio
CREATE OR REPLACE FUNCTION public.condominio_ambiente_owner(_condominio_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.conta_master(c.owner_id)
    FROM public.condominios c
   WHERE c.id = _condominio_id
$$;

REVOKE ALL ON FUNCTION public.condominio_ambiente_owner(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.condominio_ambiente_owner(uuid) TO authenticated, service_role;

-- Exclusão apenas pela conta dona do ambiente
DROP POLICY IF EXISTS condominios_delete_owner ON public.condominios;
DROP POLICY IF EXISTS condominios_delete_conta_master ON public.condominios;
CREATE POLICY condominios_delete_conta_master ON public.condominios
FOR DELETE TO authenticated
USING (auth.uid() = public.conta_master(owner_id));

-- Gatilho de compartilhamento: master com permissões completas
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
         (u.user_id = v_master), (u.user_id = v_master), (u.user_id = v_master)
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

-- Backfill: vincula a conta dona a condomínios criados por usuários do ambiente
INSERT INTO public.condominio_members (
  condominio_id, user_id, papel, criado_por,
  pode_gerenciar_contratos, pode_gerenciar_documentos,
  pode_gerenciar_assembleias, pode_gerenciar_unidades, pode_gerenciar_usuarios
)
SELECT c.id, public.conta_master(c.owner_id), 'dono_condominio'::public.papel_condo_v2,
       public.conta_master(c.owner_id), true, true, true, true, true
  FROM public.condominios c
 WHERE public.conta_master(c.owner_id) <> c.owner_id
   AND NOT EXISTS (
     SELECT 1 FROM public.condominio_members m
      WHERE m.condominio_id = c.id AND m.user_id = public.conta_master(c.owner_id));

-- Backfill: replica os condomínios do ambiente para os demais usuários vinculados
INSERT INTO public.condominio_members (
  condominio_id, user_id, papel, criado_por,
  pode_gerenciar_contratos, pode_gerenciar_documentos,
  pode_gerenciar_assembleias, pode_gerenciar_unidades, pode_gerenciar_usuarios
)
SELECT DISTINCT c.id, eq.user_id, 'operador_condominio'::public.papel_condo_v2,
       public.conta_master(c.owner_id), false, false, false, false, false
  FROM public.condominios c
  JOIN public.condominio_members eq
    ON eq.criado_por = public.conta_master(c.owner_id)
   AND eq.user_id <> public.conta_master(c.owner_id)
 WHERE eq.user_id <> c.owner_id
   AND NOT EXISTS (
     SELECT 1 FROM public.condominio_members m
      WHERE m.condominio_id = c.id AND m.user_id = eq.user_id);
