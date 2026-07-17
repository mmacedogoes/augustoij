ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS overdue_desde timestamp with time zone,
  ADD COLUMN IF NOT EXISTS suspenso_em timestamp with time zone;