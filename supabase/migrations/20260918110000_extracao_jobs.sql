-- =====================================================================
-- Tabela de jobs de extração para execução em etapas retomáveis
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.extracao_jobs (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id  UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  etapa         TEXT NOT NULL,
  total         INTEGER NOT NULL DEFAULT 0,
  concluidos    INTEGER NOT NULL DEFAULT 0,
  estado        TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'processando' | 'pronto' | 'falhou'
  erro          TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT extracao_jobs_documento_id_key UNIQUE (documento_id)
);

GRANT ALL ON public.extracao_jobs TO service_role;
GRANT ALL ON public.extracao_jobs TO authenticated;

ALTER TABLE public.extracao_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extracao_jobs_select_authenticated" ON public.extracao_jobs;
CREATE POLICY "extracao_jobs_select_authenticated"
  ON public.extracao_jobs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "extracao_jobs_all_service_role" ON public.extracao_jobs;
CREATE POLICY "extracao_jobs_all_service_role"
  ON public.extracao_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
