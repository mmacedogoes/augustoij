REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  nome,
  telefone,
  oab,
  email,
  lgpd_aceite_em,
  tipo_pessoa,
  cpf_cnpj,
  razao_social,
  onboarding_completo,
  ultimo_acesso,
  perfil_atuacao,
  onboarding_tour_completo,
  dicas_ativas,
  marketing_opt_in,
  termos_aceitos_em,
  termos_versao,
  termos_ip
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;