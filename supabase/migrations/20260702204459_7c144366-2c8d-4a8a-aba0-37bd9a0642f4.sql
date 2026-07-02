
DROP TRIGGER IF EXISTS profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_escalation
BEFORE UPDATE OF papel_sistema ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_prevent_self_escalation();

DROP POLICY IF EXISTS profiles_block_role_change ON public.profiles;
CREATE POLICY profiles_block_role_change
ON public.profiles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR papel_sistema = (SELECT p.papel_sistema FROM public.profiles p WHERE p.id = profiles.id)
);

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_metrics() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_usage_timeseries(integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.calcular_custo_mensal(uuid, date) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_prevent_self_escalation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_update_uso_mensal() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_papel_sistema(uuid, public.papel_sistema[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_condominio_member(uuid, uuid) FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(vector, integer, double precision) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(uuid, vector, integer, double precision) FROM anon, public;
