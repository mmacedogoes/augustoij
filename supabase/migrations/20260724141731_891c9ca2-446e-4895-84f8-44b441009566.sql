CREATE TABLE public.contrato_reajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  valor_anterior numeric NOT NULL,
  valor_novo numeric NOT NULL,
  indice_utilizado text NOT NULL,
  percentual_indice numeric,
  percentual_aplicado numeric NOT NULL,
  fonte text NOT NULL DEFAULT 'bcb' CHECK (fonte IN ('bcb','manual')),
  observacao text,
  aplicado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_reajustes_contrato
  ON public.contrato_reajustes(contrato_id, competencia DESC);

CREATE UNIQUE INDEX uniq_contrato_reajuste_competencia
  ON public.contrato_reajustes(contrato_id, competencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_reajustes TO authenticated;
GRANT ALL ON public.contrato_reajustes TO service_role;

ALTER TABLE public.contrato_reajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages contrato_reajustes"
  ON public.contrato_reajustes
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

ALTER TABLE public.contratos_servico
  ADD COLUMN IF NOT EXISTS ultimo_reajuste_em date;