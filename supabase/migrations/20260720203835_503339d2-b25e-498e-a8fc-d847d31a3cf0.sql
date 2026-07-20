-- Hardening dos avisos do linter de segurança: search_path fixo, revogar EXECUTE de anon
-- em SECURITY DEFINER internos, e negar acesso explícito em tabelas server-only.

-- 1) Fixar search_path em funções que ainda estavam mutáveis (fila de e-mails pgmq)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;

-- 2) Revogar EXECUTE de anon/public em SECURITY DEFINER internos (fila de e-mails,
--    protocolo do helpdesk, trigger de mensagens). Nenhuma delas é chamada por usuário
--    não autenticado — cron, triggers e server functions autenticadas continuam
--    funcionando porque preservamos EXECUTE para service_role/postgres/authenticated.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_protocolo_helpdesk() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_helpdesk_mensagem_after_insert() FROM anon, PUBLIC;

-- Garantir que quem realmente precisa continua tendo acesso.
GRANT EXECUTE ON FUNCTION public.gerar_protocolo_helpdesk() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

-- 3) Tabelas com RLS habilitado e sem policy: adicionar policy explícita de deny-all.
--    Ambas são acessadas apenas via service_role (que ignora RLS), então o efeito
--    prático é documentar a intenção "nenhum cliente lê/escreve direto".
CREATE POLICY "deny all" ON public.auth_rate_limits
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "deny all" ON public.demo_chat_usage
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);