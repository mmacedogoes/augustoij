REVOKE EXECUTE ON FUNCTION public.assembleia_registrar_voto(uuid, uuid, uuid, numeric, text, text, inet, text, text, uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assembleia_registrar_voto(uuid, uuid, uuid, numeric, text, text, inet, text, text, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.assembleia_verificar_integridade(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assembleia_verificar_integridade(uuid) TO authenticated, service_role;

ALTER FUNCTION public.normalizar_telefone_br(text) SET search_path = public;