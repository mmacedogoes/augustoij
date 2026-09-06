-- 1. Revoke anon EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.incrementar_demo_usage(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_demo_usage(text, integer) TO service_role;

-- 2. contratos_servico: split ALL policy into read (member) + write (permission-gated)
DROP POLICY IF EXISTS contratos_servico_owner_all ON public.contratos_servico;

CREATE POLICY contratos_servico_select_member ON public.contratos_servico
  FOR SELECT TO authenticated
  USING (is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY contratos_servico_insert_gated ON public.contratos_servico
  FOR INSERT TO authenticated
  WITH CHECK (pode_no_condominio(auth.uid(), condominio_id, 'contratos'));

CREATE POLICY contratos_servico_update_gated ON public.contratos_servico
  FOR UPDATE TO authenticated
  USING (pode_no_condominio(auth.uid(), condominio_id, 'contratos'))
  WITH CHECK (pode_no_condominio(auth.uid(), condominio_id, 'contratos'));

CREATE POLICY contratos_servico_delete_gated ON public.contratos_servico
  FOR DELETE TO authenticated
  USING (pode_no_condominio(auth.uid(), condominio_id, 'contratos'));

-- 3. perfis_documentais_condominio: gate writes behind 'documentos' permission
DROP POLICY IF EXISTS "Membros atualizam perfil documental" ON public.perfis_documentais_condominio;
DROP POLICY IF EXISTS "Membros criam perfil documental" ON public.perfis_documentais_condominio;

CREATE POLICY "Gestores atualizam perfil documental" ON public.perfis_documentais_condominio
  FOR UPDATE TO authenticated
  USING (pode_no_condominio(auth.uid(), condominio_id, 'documentos'))
  WITH CHECK (pode_no_condominio(auth.uid(), condominio_id, 'documentos'));

CREATE POLICY "Gestores criam perfil documental" ON public.perfis_documentais_condominio
  FOR INSERT TO authenticated
  WITH CHECK (pode_no_condominio(auth.uid(), condominio_id, 'documentos'));