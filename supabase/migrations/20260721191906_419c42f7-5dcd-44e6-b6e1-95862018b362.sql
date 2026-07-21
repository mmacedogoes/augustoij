-- Remove user-writable RLS on subscriptions to prevent self-promotion to paid plans.
-- All legitimate writes go through server functions using the service role
-- after verifying auth.uid() server-side.

DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;

-- SELECT own row stays (already exists as subscriptions_select_own).
-- No INSERT/UPDATE/DELETE policies for authenticated → default deny.
-- service_role bypasses RLS, so server functions continue to work.

-- Explicit deny-all on asaas_webhook_events INSERT/UPDATE/DELETE for authenticated
-- (webhook uses supabaseAdmin; SELECT super-admin-only policy already exists).
DROP POLICY IF EXISTS asaas_webhook_events_no_write ON public.asaas_webhook_events;
CREATE POLICY asaas_webhook_events_no_write ON public.asaas_webhook_events
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
