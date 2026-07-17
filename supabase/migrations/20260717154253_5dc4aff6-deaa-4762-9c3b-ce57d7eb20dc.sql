
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_url text,
  ADD COLUMN IF NOT EXISTS asaas_billing_type text,
  ADD COLUMN IF NOT EXISTS asaas_ciclo text,
  ADD COLUMN IF NOT EXISTS asaas_status text,
  ADD COLUMN IF NOT EXISTS asaas_ambiente text DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS pending_plano_config_id text,
  ADD COLUMN IF NOT EXISTS pending_desde timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer ON public.subscriptions(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_subscription ON public.subscriptions(asaas_subscription_id);

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text,
  payment_id text,
  subscription_id text,
  customer_id text,
  status text,
  payload jsonb NOT NULL,
  processado_em timestamptz,
  erro text,
  received_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asaas_webhook_events TO authenticated;
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_webhook_events_super_admin"
  ON public.asaas_webhook_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
