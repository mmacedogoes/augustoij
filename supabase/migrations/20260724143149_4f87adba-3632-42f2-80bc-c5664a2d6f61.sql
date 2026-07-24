
-- 1) contrato_aditivos
CREATE TABLE IF NOT EXISTS public.contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  numero text,
  data_assinatura date,
  altera_valor boolean NOT NULL DEFAULT false,
  altera_vigencia boolean NOT NULL DEFAULT false,
  altera_escopo boolean NOT NULL DEFAULT false,
  valor_anterior numeric,
  valor_novo numeric,
  data_fim_anterior date,
  vigencia_nova_fim date,
  resumo_alteracoes text,
  arquivo_path text,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contrato_aditivos_contrato
  ON public.contrato_aditivos(contrato_id, data_assinatura DESC NULLS LAST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_aditivos TO authenticated;
GRANT ALL ON public.contrato_aditivos TO service_role;

ALTER TABLE public.contrato_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aditivos_super_admin_all"
  ON public.contrato_aditivos
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_contrato_aditivos_updated_at
  BEFORE UPDATE ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) contrato_auditoria (trilha por contrato)
CREATE TABLE IF NOT EXISTS public.contrato_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  condominio_id uuid,
  acao text NOT NULL,
  descricao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contrato_auditoria_contrato
  ON public.contrato_auditoria(contrato_id, created_at DESC);

-- Leitura só para super-admin; inserção só via service_role (backend).
GRANT SELECT ON public.contrato_auditoria TO authenticated;
GRANT ALL ON public.contrato_auditoria TO service_role;

ALTER TABLE public.contrato_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_super_admin_read"
  ON public.contrato_auditoria
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 3) Colunas de análise (semáforo) em contratos_servico
ALTER TABLE public.contratos_servico
  ADD COLUMN IF NOT EXISTS analise_resultado jsonb,
  ADD COLUMN IF NOT EXISTS analise_em timestamptz;
