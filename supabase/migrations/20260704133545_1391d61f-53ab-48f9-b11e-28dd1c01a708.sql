
-- 1. Add plano_config_id to subscriptions (aligns to PLANS in src/config/plans.ts)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plano_config_id text NOT NULL DEFAULT 'gratuito';

-- Backfill using existing plano_id / plano enum when we can guess
UPDATE public.subscriptions
SET plano_config_id = CASE
  WHEN plano_id = 'pf_basico' THEN 'essencial'
  WHEN plano_id = 'pf_pro' THEN 'profissional'
  WHEN plano_id = 'pj_starter' THEN 'gestao'
  WHEN plano_id = 'pj_enterprise' THEN 'administradora'
  WHEN plano_id = 'pj_ilimitado' THEN 'personalizado'
  ELSE 'gratuito'
END
WHERE plano_config_id = 'gratuito' AND plano_id IS NOT NULL;

-- 2. uso_diario table (only strictly needed for planos com limite diário)
CREATE TABLE IF NOT EXISTS public.uso_diario (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia date NOT NULL,
  total_mensagens integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dia)
);

GRANT SELECT ON public.uso_diario TO authenticated;
GRANT ALL ON public.uso_diario TO service_role;

ALTER TABLE public.uso_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso_diario_select_own" ON public.uso_diario
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "uso_diario_admin_read" ON public.uso_diario
  FOR SELECT TO authenticated
  USING (is_any_admin(auth.uid()));

-- 3. Update trigger to also increment uso_diario for assistant messages
CREATE OR REPLACE FUNCTION public.tg_update_uso_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _mes text;
  _dia date;
  _custo numeric;
  _credits numeric;
  _credito_brl numeric;
BEGIN
  IF NEW.papel <> 'assistant' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO _user_id FROM public.conversas WHERE id = NEW.conversa_id;
  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _mes := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  _dia := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT COALESCE(credito_brl, 0.05) INTO _credito_brl FROM public.config_alertas WHERE id = 1;
  _credito_brl := COALESCE(_credito_brl, 0.05);

  _credits := COALESCE(NEW.creditos_lovable, 0);
  IF _credits > 0 THEN
    _custo := _credits * _credito_brl;
  ELSE
    _custo := COALESCE(NEW.tokens_usados, 0) * 0.000015;
  END IF;

  INSERT INTO public.uso_mensal (user_id, mes_ano, total_mensagens, total_tokens, total_credits, custo_estimado_brl)
  VALUES (_user_id, _mes, 1, COALESCE(NEW.tokens_usados, 0), _credits, _custo)
  ON CONFLICT (user_id, mes_ano) DO UPDATE
  SET total_mensagens = public.uso_mensal.total_mensagens + 1,
      total_tokens = public.uso_mensal.total_tokens + COALESCE(NEW.tokens_usados, 0),
      total_credits = COALESCE(public.uso_mensal.total_credits, 0) + _credits,
      custo_estimado_brl = public.uso_mensal.custo_estimado_brl + _custo,
      updated_at = now();

  INSERT INTO public.uso_diario (user_id, dia, total_mensagens)
  VALUES (_user_id, _dia, 1)
  ON CONFLICT (user_id, dia) DO UPDATE
  SET total_mensagens = public.uso_diario.total_mensagens + 1,
      updated_at = now();

  RETURN NEW;
END;
$$;
