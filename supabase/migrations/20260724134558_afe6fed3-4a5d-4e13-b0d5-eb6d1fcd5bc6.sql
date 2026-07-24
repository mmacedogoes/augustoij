-- ============ contrato_eventos: novas colunas + unique automático ============
ALTER TABLE public.contrato_eventos
  ADD COLUMN IF NOT EXISTS antecedencia_dias int,
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'automatico',
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'contrato_eventos_origem_check'
  ) THEN
    ALTER TABLE public.contrato_eventos
      ADD CONSTRAINT contrato_eventos_origem_check
      CHECK (origem IN ('automatico','manual'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contrato_evento_automatico
  ON public.contrato_eventos (contrato_id, tipo, data_evento, COALESCE(antecedencia_dias, -1))
  WHERE origem = 'automatico';

CREATE INDEX IF NOT EXISTS idx_contrato_eventos_status_data
  ON public.contrato_eventos (status, data_evento)
  WHERE status = 'pendente';

-- ============ notificacoes: nova tabela ============
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  categoria text NOT NULL DEFAULT 'contrato',
  url_destino text,
  contrato_id uuid REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES public.contrato_eventos(id) ON DELETE CASCADE,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user
  ON public.notificacoes(user_id, lida_em);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_created
  ON public.notificacoes(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_owner_read"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notificacoes_owner_update"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notificacoes_super_admin_all"
  ON public.notificacoes FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
