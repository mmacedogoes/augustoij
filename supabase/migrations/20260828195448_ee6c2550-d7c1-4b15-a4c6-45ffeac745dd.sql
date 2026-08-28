REVOKE ALL ON FUNCTION public.tg_condominio_compartilhar_equipe() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_condominio_compartilhar_equipe() TO service_role;