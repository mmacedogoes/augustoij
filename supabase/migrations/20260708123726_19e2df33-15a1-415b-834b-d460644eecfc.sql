
-- 1) Tabela de eventos de IA fora do chat
CREATE TABLE public.eventos_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  condominio_id   uuid REFERENCES public.condominios(id) ON DELETE SET NULL,
  origem          text NOT NULL,
  model           text,
  tokens_input    integer NOT NULL DEFAULT 0,
  tokens_output   integer NOT NULL DEFAULT 0,
  creditos_lovable numeric(14,6) NOT NULL DEFAULT 0,
  custo_brl       numeric(12,6) NOT NULL DEFAULT 0,
  aig_log_id      text,
  aig_run_id      text,
  meta            jsonb
);

CREATE INDEX eventos_ia_user_created_idx  ON public.eventos_ia (user_id, created_at DESC);
CREATE INDEX eventos_ia_origem_idx        ON public.eventos_ia (origem, created_at DESC);
CREATE INDEX eventos_ia_created_idx       ON public.eventos_ia (created_at DESC);

GRANT SELECT ON public.eventos_ia TO authenticated;
GRANT ALL    ON public.eventos_ia TO service_role;

ALTER TABLE public.eventos_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_ia_select_own"
  ON public.eventos_ia FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "eventos_ia_select_admin"
  ON public.eventos_ia FOR SELECT
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Nenhuma política de INSERT/UPDATE/DELETE para authenticated:
-- só serviços com service_role podem gravar.

-- 2) Preço do modelo de embedding (nome real usado no gateway)
INSERT INTO public.model_pricing (model, credits_per_input_token, credits_per_output_token)
VALUES ('openai/text-embedding-3-small', 0.00000008, 0)
ON CONFLICT (model) DO NOTHING;

-- 3) Trigger de agregação — soma tokens/créditos/custo em uso_mensal
--    e custos_cliente_mensal quando o evento pertence a um usuário.
CREATE OR REPLACE FUNCTION public.tg_eventos_ia_agrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mes text;
  _primeiro_dia date;
  _custo numeric := 0;
  _credito_brl numeric := 0.05;
  _is_embed boolean;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(credito_brl, 0.05) INTO _credito_brl
    FROM public.config_alertas WHERE id = 1;
  _credito_brl := COALESCE(_credito_brl, 0.05);

  IF NEW.custo_brl IS NOT NULL AND NEW.custo_brl > 0 THEN
    _custo := NEW.custo_brl;
  ELSE
    _custo := COALESCE(NEW.creditos_lovable, 0) * _credito_brl;
  END IF;

  _mes := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM');
  _primeiro_dia := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date;
  _is_embed := (NEW.origem LIKE 'embedding_%');

  -- Agrega em uso_mensal (NÃO incrementa total_mensagens — cota do plano
  -- continua sendo controlada apenas por mensagens do chat).
  INSERT INTO public.uso_mensal (
    user_id, mes_ano, total_mensagens, total_tokens, total_credits, custo_estimado_brl
  ) VALUES (
    NEW.user_id, _mes, 0,
    COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0),
    COALESCE(NEW.creditos_lovable, 0),
    _custo
  )
  ON CONFLICT (user_id, mes_ano) DO UPDATE
    SET total_tokens       = public.uso_mensal.total_tokens
                             + COALESCE(NEW.tokens_input, 0)
                             + COALESCE(NEW.tokens_output, 0),
        total_credits      = COALESCE(public.uso_mensal.total_credits, 0)
                             + COALESCE(NEW.creditos_lovable, 0),
        custo_estimado_brl = public.uso_mensal.custo_estimado_brl + _custo,
        updated_at         = now();

  -- Agrega em custos_cliente_mensal separando embeddings do restante.
  INSERT INTO public.custos_cliente_mensal (
    user_id, mes_ano,
    custo_tokens_openai, custo_embeddings, custo_storage,
    total_mensagens, total_tokens_input, total_tokens_output, margem_estimada
  ) VALUES (
    NEW.user_id, _primeiro_dia,
    CASE WHEN _is_embed THEN 0 ELSE _custo END,
    CASE WHEN _is_embed THEN _custo ELSE 0 END,
    0,
    0,
    COALESCE(NEW.tokens_input, 0),
    COALESCE(NEW.tokens_output, 0),
    0
  )
  ON CONFLICT (user_id, mes_ano) DO UPDATE SET
    custo_tokens_openai = public.custos_cliente_mensal.custo_tokens_openai
                          + CASE WHEN _is_embed THEN 0 ELSE _custo END,
    custo_embeddings    = public.custos_cliente_mensal.custo_embeddings
                          + CASE WHEN _is_embed THEN _custo ELSE 0 END,
    total_tokens_input  = public.custos_cliente_mensal.total_tokens_input
                          + COALESCE(NEW.tokens_input, 0),
    total_tokens_output = public.custos_cliente_mensal.total_tokens_output
                          + COALESCE(NEW.tokens_output, 0);

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_eventos_ia_agrega_after_insert
AFTER INSERT ON public.eventos_ia
FOR EACH ROW EXECUTE FUNCTION public.tg_eventos_ia_agrega();
