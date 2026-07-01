
CREATE TABLE IF NOT EXISTS public.demo_chat_usage (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.demo_chat_usage TO service_role;

ALTER TABLE public.demo_chat_usage ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role (bypasses RLS) can read/write this table
