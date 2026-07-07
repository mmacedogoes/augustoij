CREATE OR REPLACE FUNCTION public.tg_update_uso_mensal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _mes text;
  _dia date;
  _primeiro_dia date;
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
  _primeiro_dia := date_trunc('month', _dia)::date;

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

  -- Custo Lovable é upsertado automaticamente em custos_cliente_mensal.
  -- Não sobrescreve custo_embeddings nem custo_storage (controle manual).
  INSERT INTO public.custos_cliente_mensal (
    user_id, mes_ano, custo_tokens_openai, custo_embeddings, custo_storage,
    total_mensagens, total_tokens_input, total_tokens_output, margem_estimada
  ) VALUES (
    _user_id, _primeiro_dia, _custo, 0, 0,
    1, 0, COALESCE(NEW.tokens_usados, 0), 0
  )
  ON CONFLICT (user_id, mes_ano) DO UPDATE SET
    custo_tokens_openai = public.custos_cliente_mensal.custo_tokens_openai + _custo,
    total_mensagens     = public.custos_cliente_mensal.total_mensagens + 1,
    total_tokens_output = public.custos_cliente_mensal.total_tokens_output + COALESCE(NEW.tokens_usados, 0);

  RETURN NEW;
END;
$function$;

-- Sincroniza o mês corrente com o total já acumulado em uso_mensal,
-- garantindo que o custo Lovable exibido na área financeira reflita
-- o histórico atual mesmo antes da próxima mensagem chegar.
DO $$
DECLARE
  _mes text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  _primeiro_dia date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date;
  _credito_brl numeric;
  r record;
  _custo numeric;
BEGIN
  SELECT COALESCE(credito_brl, 0.05) INTO _credito_brl FROM public.config_alertas WHERE id = 1;
  _credito_brl := COALESCE(_credito_brl, 0.05);

  FOR r IN SELECT user_id, total_mensagens, total_tokens, total_credits, custo_estimado_brl
           FROM public.uso_mensal WHERE mes_ano = _mes LOOP
    IF COALESCE(r.total_credits, 0) > 0 THEN
      _custo := r.total_credits * _credito_brl;
    ELSE
      _custo := COALESCE(r.custo_estimado_brl, 0);
    END IF;

    INSERT INTO public.custos_cliente_mensal (
      user_id, mes_ano, custo_tokens_openai, custo_embeddings, custo_storage,
      total_mensagens, total_tokens_input, total_tokens_output, margem_estimada
    ) VALUES (
      r.user_id, _primeiro_dia, _custo, 0, 0,
      COALESCE(r.total_mensagens, 0), 0, COALESCE(r.total_tokens, 0), 0
    )
    ON CONFLICT (user_id, mes_ano) DO UPDATE SET
      custo_tokens_openai = EXCLUDED.custo_tokens_openai,
      total_mensagens     = EXCLUDED.total_mensagens,
      total_tokens_output = EXCLUDED.total_tokens_output;
  END LOOP;
END $$;