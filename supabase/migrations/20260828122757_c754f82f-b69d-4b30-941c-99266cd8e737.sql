ALTER TABLE public.condominio_members
  ADD COLUMN IF NOT EXISTS pode_gerenciar_contratos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_documentos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_assembleias boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_unidades boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_usuarios boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_condominio_members_updated_at ON public.condominio_members;
CREATE TRIGGER trg_condominio_members_updated_at
BEFORE UPDATE ON public.condominio_members
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_members TO authenticated;
GRANT ALL ON public.condominio_members TO service_role;

CREATE OR REPLACE FUNCTION public.pode_no_condominio(_user_id uuid, _condominio_id uuid, _permissao text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.condominios c
     WHERE c.id = _condominio_id AND c.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.condominio_members m
     WHERE m.condominio_id = _condominio_id
       AND m.user_id = _user_id
       AND (
         m.papel = 'dono_condominio'::public.papel_condo_v2
         OR (_permissao = 'contratos'   AND m.pode_gerenciar_contratos)
         OR (_permissao = 'documentos'  AND m.pode_gerenciar_documentos)
         OR (_permissao = 'assembleias' AND m.pode_gerenciar_assembleias)
         OR (_permissao = 'unidades'    AND m.pode_gerenciar_unidades)
         OR (_permissao = 'usuarios'    AND m.pode_gerenciar_usuarios)
       )
  )
$$;

REVOKE ALL ON FUNCTION public.pode_no_condominio(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pode_no_condominio(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS documentos_delete_dono ON public.documentos;
CREATE POLICY documentos_delete_dono ON public.documentos
FOR DELETE TO authenticated
USING (public.pode_no_condominio(auth.uid(), condominio_id, 'documentos'));