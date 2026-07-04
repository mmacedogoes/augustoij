
-- 1) Preços reais (créditos Lovable por token)
UPDATE public.model_pricing
   SET credits_per_input_token = 0.000002,
       credits_per_output_token = 0.000012,
       updated_at = now()
 WHERE model IN ('google/gemini-3-flash-preview','google/gemini-2.5-flash');

UPDATE public.model_pricing
   SET credits_per_input_token = 0.00000008,
       credits_per_output_token = 0,
       updated_at = now()
 WHERE model = 'text-embedding-3-small';

-- 2) Recalcula creditos_lovable por mensagem
-- Caso A: temos split tokens_input/tokens_output → cálculo exato
UPDATE public.mensagens m
   SET creditos_lovable = COALESCE(m.tokens_input,0) * mp.credits_per_input_token
                       + COALESCE(m.tokens_output,0) * mp.credits_per_output_token
  FROM public.model_pricing mp
 WHERE m.papel = 'assistant'
   AND m.model_usado = mp.model
   AND (m.tokens_input IS NOT NULL OR m.tokens_output IS NOT NULL);

-- Caso B: só temos tokens_usados (mensagens antigas) → estima usando
-- a razão média medida no gateway (~97,9% input / 2,1% output para o
-- chat model). Só aplica quando ainda está NULL e o modelo tem preço.
UPDATE public.mensagens m
   SET creditos_lovable = COALESCE(m.tokens_usados,0)
        * (0.979 * mp.credits_per_input_token + 0.021 * mp.credits_per_output_token)
  FROM public.model_pricing mp
 WHERE m.papel = 'assistant'
   AND m.model_usado = mp.model
   AND m.creditos_lovable IS NULL
   AND COALESCE(m.tokens_usados,0) > 0;

-- 3) Recalcula uso_mensal.total_credits e custo_estimado_brl a partir das mensagens
WITH agg AS (
  SELECT c.user_id,
         to_char(m.created_at,'YYYY-MM') AS mes_ano,
         SUM(COALESCE(m.creditos_lovable,0)) AS creditos
    FROM public.mensagens m
    JOIN public.conversas c ON c.id = m.conversa_id
   WHERE m.papel = 'assistant'
   GROUP BY 1, 2
),
cfg AS (
  SELECT COALESCE(credito_brl,0.05) AS credito_brl FROM public.config_alertas WHERE id = 1
)
UPDATE public.uso_mensal u
   SET total_credits = agg.creditos,
       custo_estimado_brl = agg.creditos * (SELECT credito_brl FROM cfg),
       updated_at = now()
  FROM agg
 WHERE u.user_id = agg.user_id
   AND u.mes_ano = agg.mes_ano;
