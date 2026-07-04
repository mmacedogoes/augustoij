
ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS tokens_input int,
  ADD COLUMN IF NOT EXISTS tokens_output int,
  ADD COLUMN IF NOT EXISTS creditos_lovable numeric(14,6);

ALTER TABLE public.uso_mensal
  ADD COLUMN IF NOT EXISTS total_credits numeric(14,4) DEFAULT 0;

ALTER TABLE public.config_alertas
  ADD COLUMN IF NOT EXISTS credito_brl numeric(10,4) DEFAULT 0.05;

CREATE TABLE IF NOT EXISTS public.model_pricing (
  model text PRIMARY KEY,
  credits_per_input_token numeric(20,12) NOT NULL DEFAULT 0,
  credits_per_output_token numeric(20,12) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.model_pricing TO authenticated;
GRANT ALL ON public.model_pricing TO service_role;

ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam model_pricing" ON public.model_pricing;
CREATE POLICY "Admins gerenciam model_pricing"
  ON public.model_pricing FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS "Autenticados leem model_pricing" ON public.model_pricing;
CREATE POLICY "Autenticados leem model_pricing"
  ON public.model_pricing FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.model_pricing (model, credits_per_input_token, credits_per_output_token) VALUES
  ('google/gemini-3-flash-preview', 0.0000075, 0.00003),
  ('google/gemini-2.5-flash', 0.0000075, 0.00003),
  ('google/gemini-2.5-flash-lite', 0.000001, 0.000004),
  ('google/gemini-2.5-pro', 0.0000125, 0.00005),
  ('text-embedding-3-small', 0.0000002, 0)
ON CONFLICT (model) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tg_update_uso_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _mes text;
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

  _mes := to_char(now(),'YYYY-MM');
  SELECT COALESCE(credito_brl, 0.05) INTO _credito_brl FROM public.config_alertas WHERE id = 1;
  _credito_brl := COALESCE(_credito_brl, 0.05);

  _credits := COALESCE(NEW.creditos_lovable, 0);
  IF _credits > 0 THEN
    _custo := _credits * _credito_brl;
  ELSE
    _custo := COALESCE(NEW.tokens_usados,0) * 0.000015;
  END IF;

  INSERT INTO public.uso_mensal (user_id, mes_ano, total_mensagens, total_tokens, total_credits, custo_estimado_brl)
  VALUES (_user_id, _mes, 1, COALESCE(NEW.tokens_usados,0), _credits, _custo)
  ON CONFLICT (user_id, mes_ano) DO UPDATE
  SET total_mensagens = public.uso_mensal.total_mensagens + 1,
      total_tokens = public.uso_mensal.total_tokens + COALESCE(NEW.tokens_usados,0),
      total_credits = COALESCE(public.uso_mensal.total_credits,0) + _credits,
      custo_estimado_brl = public.uso_mensal.custo_estimado_brl + _custo,
      updated_at = now();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_custos_cliente_mensal(_user_id uuid, _mes_ano date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _mes text := to_char(_mes_ano, 'YYYY-MM');
  _msgs int := 0;
  _tokens int := 0;
  _credits numeric := 0;
  _custo_io numeric := 0;
  _bytes bigint := 0;
  _custo_storage numeric := 0;
  _mb_rate numeric := 0.0001;
  _credito_brl numeric := 0.05;
BEGIN
  SELECT COALESCE(total_mensagens,0), COALESCE(total_tokens,0), COALESCE(total_credits,0)
    INTO _msgs, _tokens, _credits
    FROM public.uso_mensal
    WHERE user_id = _user_id AND mes_ano = _mes;

  SELECT COALESCE(custo_storage_mb_brl, 0.0001), COALESCE(credito_brl, 0.05)
    INTO _mb_rate, _credito_brl
    FROM public.config_alertas WHERE id = 1;

  IF _credits > 0 THEN
    _custo_io := _credits * _credito_brl;
  ELSE
    _custo_io := COALESCE(_tokens,0) * 0.000015;
  END IF;

  SELECT public.storage_bytes_by_user(_user_id) INTO _bytes;
  _custo_storage := (_bytes::numeric / 1048576.0) * COALESCE(_mb_rate, 0.0001);

  INSERT INTO public.custos_cliente_mensal (
    user_id, mes_ano, custo_tokens_openai, custo_embeddings, custo_storage,
    total_mensagens, total_tokens_input, total_tokens_output, margem_estimada
  ) VALUES (
    _user_id, _mes_ano, _custo_io, 0, _custo_storage,
    _msgs, 0, _tokens, 0
  )
  ON CONFLICT (user_id, mes_ano) DO UPDATE SET
    custo_tokens_openai = EXCLUDED.custo_tokens_openai,
    custo_storage = EXCLUDED.custo_storage,
    total_mensagens = EXCLUDED.total_mensagens,
    total_tokens_output = EXCLUDED.total_tokens_output;
END;
$function$;
