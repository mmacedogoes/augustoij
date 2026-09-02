-- Migracao: Campos para gestao de Plano Personalizado e integracao Asaas em subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_preco numeric(10,2),
  ADD COLUMN IF NOT EXISTS custom_ciclo text DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS custom_billing_type text DEFAULT 'UNDEFINED',
  ADD COLUMN IF NOT EXISTS custom_vencimento_dias integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS custom_limits jsonb,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_sub_id ON public.subscriptions(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_cust_id ON public.subscriptions(asaas_customer_id);
