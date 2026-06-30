
-- 1) Prevent self-escalation of papel_sistema and app role columns on profiles
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND papel_sistema = (SELECT p.papel_sistema FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2) Storage: add UPDATE policy for documentos bucket (only condominio members; matches existing INSERT scope)
DROP POLICY IF EXISTS "Membros podem atualizar arquivos do condominio" ON storage.objects;
CREATE POLICY "Membros podem atualizar arquivos do condominio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND is_condominio_member(((storage.foldername(name))[1])::uuid, auth.uid()))
  WITH CHECK (bucket_id = 'documentos' AND is_condominio_member(((storage.foldername(name))[1])::uuid, auth.uid()));

-- Also add UPDATE policy for kb-documentos bucket (admin only) for consistency
DROP POLICY IF EXISTS kb_objects_admin_update ON storage.objects;
CREATE POLICY kb_objects_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kb-documentos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'kb-documentos' AND has_role(auth.uid(), 'admin'::app_role));

-- 3) Lock down SECURITY DEFINER functions in public schema.
-- Revoke EXECUTE from anon (and from authenticated where the function is not callable by app code).
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_usage_timeseries(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calcular_custo_mensal(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_papel_sistema(uuid, papel_sistema[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(uuid, vector, integer, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(vector, integer, double precision) FROM PUBLIC, anon;

-- Trigger function should not be callable directly by anyone
REVOKE EXECUTE ON FUNCTION public.tg_update_uso_mensal() FROM PUBLIC, anon, authenticated;
