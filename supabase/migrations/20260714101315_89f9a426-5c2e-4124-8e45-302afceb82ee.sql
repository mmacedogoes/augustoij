ALTER TABLE public.contratos_locacao
  ADD COLUMN IF NOT EXISTS data_fim_vigencia date,
  ADD COLUMN IF NOT EXISTS data_renovacao date,
  ADD COLUMN IF NOT EXISTS historico_renovacoes jsonb NOT NULL DEFAULT '[]'::jsonb;