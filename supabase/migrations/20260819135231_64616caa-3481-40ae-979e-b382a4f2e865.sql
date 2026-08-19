-- Refinando permissões de execução para evitar alertas de segurança
ALTER FUNCTION public.assembleia_gerar_recibo() SET search_path = public;
ALTER FUNCTION public.assembleia_verificar_integridade(uuid) SET search_path = public;
ALTER FUNCTION public.tg_assembleia_voto_antes_inserir() SET search_path = public;
ALTER FUNCTION public.tg_assembleia_voto_bloquear() SET search_path = public;
ALTER FUNCTION public.tg_assembleia_habilitacao_antes_inserir() SET search_path = public;
ALTER FUNCTION public.tg_convocacao_destinatario_normalizar() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.assembleia_gerar_recibo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assembleia_gerar_recibo() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assembleia_gerar_recibo() TO service_role;

REVOKE EXECUTE ON FUNCTION public.assembleia_verificar_integridade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assembleia_verificar_integridade(uuid) TO authenticated;

-- Garantindo que tabelas internas tenham RLS (mesmo que vazias) para o linter
-- assembleia_votos_controle, assembleia_sessoes_votante, assembleia_cabine_tokens
-- Essas tabelas já tiveram RLS habilitado, mas não têm políticas para authenticated por design (apenas service_role).
-- O linter reclama se não houver NENHUMA política. Adicionaremos uma política dummy que nega tudo para satisfazer o linter.

CREATE POLICY "Linter satisfy - Deny all authenticated" ON public.assembleia_votos_controle FOR ALL TO authenticated USING (false);
CREATE POLICY "Linter satisfy - Deny all authenticated" ON public.assembleia_sessoes_votante FOR ALL TO authenticated USING (false);
CREATE POLICY "Linter satisfy - Deny all authenticated" ON public.assembleia_cabine_tokens FOR ALL TO authenticated USING (false);
