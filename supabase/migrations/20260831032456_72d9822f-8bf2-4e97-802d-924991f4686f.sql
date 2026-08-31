CREATE OR REPLACE FUNCTION public.tg_profiles_prevent_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    NEW.papel_sistema := OLD.papel_sistema;
    NEW.ativo := OLD.ativo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_self_escalation ON public.profiles;
DROP TRIGGER IF EXISTS profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_prevent_self_escalation();

REVOKE EXECUTE ON FUNCTION public.tg_profiles_prevent_self_escalation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_profiles_prevent_self_escalation() TO service_role;