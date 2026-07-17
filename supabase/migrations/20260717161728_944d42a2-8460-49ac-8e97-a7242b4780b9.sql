
-- Cancellations tracking
CREATE TABLE public.cancelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_config_id text,
  asaas_subscription_id text,
  motivo text NOT NULL,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cancelamentos TO authenticated;
GRANT ALL ON public.cancelamentos TO service_role;

ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_insert_own_cancelamento"
  ON public.cancelamentos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_read_own_cancelamento"
  ON public.cancelamentos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_read_all_cancelamentos"
  ON public.cancelamentos FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE INDEX idx_cancelamentos_created ON public.cancelamentos(created_at DESC);
CREATE INDEX idx_cancelamentos_motivo ON public.cancelamentos(motivo);

-- Track cancellation on subscription row
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
