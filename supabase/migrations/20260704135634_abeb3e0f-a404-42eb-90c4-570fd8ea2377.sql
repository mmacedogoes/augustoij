
-- Adiciona flag de cortesia (usuário admin sem limites) e status aguardando pagamento
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cortesia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cortesia_concedida_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cortesia_observacao text;

-- Índice leve para lookups admin
CREATE INDEX IF NOT EXISTS idx_subscriptions_cortesia ON public.subscriptions (cortesia) WHERE cortesia = true;
