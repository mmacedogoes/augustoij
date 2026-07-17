ALTER TABLE public.subscriptions ALTER COLUMN trial_end SET DEFAULT (now() + interval '7 days');

UPDATE public.subscriptions
SET trial_end = created_at + interval '7 days'
WHERE status = 'trialing'
  AND COALESCE(cortesia, false) = false
  AND created_at >= now() - interval '24 hours'
  AND trial_end IS NOT NULL
  AND trial_end < created_at + interval '7 days';