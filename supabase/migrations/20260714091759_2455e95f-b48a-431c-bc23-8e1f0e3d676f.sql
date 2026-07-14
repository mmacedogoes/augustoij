
-- Índice único para idempotência da geração de parcelas
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_contrato_tipo_competencia_key
  ON public.pagamentos (contrato_locacao_id, tipo, competencia);

-- Tabela para marcar alertas como resolvidos/checados
CREATE TABLE IF NOT EXISTS public.alertas_resolvidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chave text NOT NULL,
  resolvido_em timestamptz NOT NULL DEFAULT now(),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_admin_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_resolvidos TO authenticated;
GRANT ALL ON public.alertas_resolvidos TO service_role;

ALTER TABLE public.alertas_resolvidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin gerencia seus alertas resolvidos"
  ON public.alertas_resolvidos FOR ALL
  USING (owner_admin_id = auth.uid() AND public.is_super_admin(auth.uid()))
  WITH CHECK (owner_admin_id = auth.uid() AND public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_alertas_resolvidos_updated_at
  BEFORE UPDATE ON public.alertas_resolvidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
