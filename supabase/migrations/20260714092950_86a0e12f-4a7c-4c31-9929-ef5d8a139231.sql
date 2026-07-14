
CREATE TABLE public.reajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_locacao_id uuid NOT NULL REFERENCES public.contratos_locacao(id) ON DELETE CASCADE,
  owner_admin_id uuid NOT NULL,
  data date NOT NULL DEFAULT (now()::date),
  indice_usado text NOT NULL,
  percentual numeric NOT NULL,
  valor_anterior numeric NOT NULL,
  valor_novo numeric NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reajustes TO authenticated;
GRANT ALL ON public.reajustes TO service_role;
ALTER TABLE public.reajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reajustes super admin"
  ON public.reajustes FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX idx_reajustes_contrato ON public.reajustes(contrato_locacao_id, data DESC);

CREATE TABLE public.indices_bcb_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serie integer NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  valor numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(serie, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indices_bcb_cache TO authenticated;
GRANT ALL ON public.indices_bcb_cache TO service_role;
ALTER TABLE public.indices_bcb_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "indices_bcb_cache super admin read"
  ON public.indices_bcb_cache FOR SELECT
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "indices_bcb_cache super admin write"
  ON public.indices_bcb_cache FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));
