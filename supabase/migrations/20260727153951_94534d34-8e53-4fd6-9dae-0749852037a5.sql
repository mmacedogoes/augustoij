CREATE TABLE public.uso_razoavel_alertas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensagens','contratos')),
  mes_ano text NOT NULL,
  valor_atingido integer NOT NULL,
  notificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, mes_ano)
);

GRANT SELECT ON public.uso_razoavel_alertas TO authenticated;
GRANT ALL ON public.uso_razoavel_alertas TO service_role;

ALTER TABLE public.uso_razoavel_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_proprios_alertas_uso_razoavel"
  ON public.uso_razoavel_alertas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_gerencia_alertas_uso_razoavel"
  ON public.uso_razoavel_alertas
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_uso_razoavel_alertas_user_mes
  ON public.uso_razoavel_alertas (user_id, mes_ano);