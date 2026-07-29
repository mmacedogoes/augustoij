-- Restringir alertas_uso: usuário só lê os próprios; escrita apenas server-side.
DROP POLICY IF EXISTS "alertas_uso_write_own" ON public.alertas_uso;

-- Garante que service_role continue com acesso total (usado pelos triggers/RPCs SECURITY DEFINER e supabaseAdmin).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'alertas_uso' AND policyname = 'alertas_uso_service_role_all'
  ) THEN
    CREATE POLICY "alertas_uso_service_role_all"
      ON public.alertas_uso
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Revoga privilégios de escrita do papel authenticated no nível da tabela (defesa em profundidade).
REVOKE INSERT, UPDATE, DELETE ON public.alertas_uso FROM authenticated;
GRANT SELECT ON public.alertas_uso TO authenticated;
GRANT ALL ON public.alertas_uso TO service_role;