GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_papel_sistema(uuid, public.papel_sistema[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_condominio_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_papel_sistema(uuid) TO authenticated, service_role;