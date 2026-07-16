-- 1) documentos: remove DELETE amplo por membro; mantém só o de dono
DROP POLICY IF EXISTS documentos_delete_member ON public.documentos;

-- 2) kb_documentos: padroniza admin check em is_any_admin()
DROP POLICY IF EXISTS kb_documentos_admin_write ON public.kb_documentos;
CREATE POLICY kb_documentos_admin_write ON public.kb_documentos
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

-- 3) profiles: guarda determinística contra auto-escalada de papel
CREATE OR REPLACE FUNCTION public.get_papel_sistema(_id uuid)
RETURNS public.papel_sistema
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT papel_sistema FROM public.profiles WHERE id = _id
$$;

REVOKE EXECUTE ON FUNCTION public.get_papel_sistema(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_papel_sistema(uuid) TO service_role;

DROP POLICY IF EXISTS profiles_block_role_change ON public.profiles;
CREATE POLICY profiles_block_role_change ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR papel_sistema = public.get_papel_sistema(id)
  );