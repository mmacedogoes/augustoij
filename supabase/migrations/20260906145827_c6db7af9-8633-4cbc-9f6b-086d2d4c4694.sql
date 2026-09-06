ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_preco numeric(10,2),
  ADD COLUMN IF NOT EXISTS custom_ciclo text DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS custom_billing_type text DEFAULT 'UNDEFINED',
  ADD COLUMN IF NOT EXISTS custom_vencimento_dias integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS custom_dia_vencimento integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS custom_limits jsonb,
  ADD COLUMN IF NOT EXISTS vinculado_a_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_sub_id ON public.subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_cust_id ON public.subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vinculado_a ON public.subscriptions(vinculado_a_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_criado_por ON public.profiles(criado_por);