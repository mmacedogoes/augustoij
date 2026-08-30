ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS conversas_metadata_gin ON public.conversas USING gin (metadata);