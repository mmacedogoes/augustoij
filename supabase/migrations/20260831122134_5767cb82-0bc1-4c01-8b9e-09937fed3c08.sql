CREATE TABLE IF NOT EXISTS public.extracao_cache (
  hash_lote text NOT NULL,
  versao_prompt text NOT NULL,
  resposta_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hash_lote, versao_prompt)
);

GRANT ALL ON public.extracao_cache TO service_role;

ALTER TABLE public.extracao_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extracao_cache_sem_acesso_direto" ON public.extracao_cache;
CREATE POLICY "extracao_cache_sem_acesso_direto"
  ON public.extracao_cache FOR ALL TO authenticated
  USING (false) WITH CHECK (false);