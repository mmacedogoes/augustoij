-- Política redundante + insegura: USING (true) em UPDATE permitia qualquer
-- authenticated alterar qualquer profile (o WITH CHECK apenas impedia mudar
-- papel_sistema, mas nome/email/telefone ficavam abertos). O trigger
-- public.tg_profiles_prevent_self_escalation já bloqueia auto-escalada.
DROP POLICY IF EXISTS "profiles_block_role_change" ON public.profiles;

-- Política tautológica em tabela usada apenas pelo service_role
-- (que bypassa RLS de qualquer forma). Removida para o scanner não sinalizar.
DROP POLICY IF EXISTS "service_role_gerencia_alertas_uso_razoavel" ON public.uso_razoavel_alertas;