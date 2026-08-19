-- Correção de Segurança (Linter)
-- Adicionando search_path e restringindo execução de funções SECURITY DEFINER

ALTER FUNCTION public.assembleia_gerar_recibo() SET search_path = public;
ALTER FUNCTION public.tg_assembleia_voto_antes_inserir() SET search_path = public;
ALTER FUNCTION public.tg_assembleia_voto_bloquear() SET search_path = public;
ALTER FUNCTION public.tg_assembleia_habilitacao_antes_inserir() SET search_path = public;
ALTER FUNCTION public.tg_convocacao_destinatario_normalizar() SET search_path = public;

-- Restringindo execução
REVOKE ALL ON FUNCTION public.assembleia_gerar_recibo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assembleia_gerar_recibo() TO service_role;

REVOKE ALL ON FUNCTION public.assembleia_verificar_integridade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assembleia_verificar_integridade(uuid) TO authenticated;

