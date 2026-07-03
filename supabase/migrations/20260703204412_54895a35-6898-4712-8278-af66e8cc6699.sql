
-- ============================================================
-- Tabela: config_alertas (singleton)
-- ============================================================
CREATE TABLE public.config_alertas (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  thresholds int[] NOT NULL DEFAULT ARRAY[50,80,100],
  notificar_admin boolean NOT NULL DEFAULT true,
  notificar_usuarios boolean NOT NULL DEFAULT false,
  custo_storage_mb_brl numeric(10,6) NOT NULL DEFAULT 0.0001,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.config_alertas TO authenticated;
GRANT ALL ON public.config_alertas TO service_role;

ALTER TABLE public.config_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_alertas_select_any_admin" ON public.config_alertas
  FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE POLICY "config_alertas_super_write" ON public.config_alertas
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.config_alertas (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER set_config_alertas_updated_at
  BEFORE UPDATE ON public.config_alertas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Tabela: alertas_uso
-- ============================================================
CREATE TABLE public.alertas_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensagens','storage')),
  threshold_pct int NOT NULL,
  percentual_atingido numeric(6,2) NOT NULL,
  disparado_em timestamptz NOT NULL DEFAULT now(),
  notificou_admin boolean NOT NULL DEFAULT false,
  notificou_usuario boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, mes_ano, tipo, threshold_pct)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_uso TO authenticated;
GRANT ALL ON public.alertas_uso TO service_role;

ALTER TABLE public.alertas_uso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_uso_select_own_or_admin" ON public.alertas_uso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_any_admin(auth.uid()));

CREATE POLICY "alertas_uso_super_write" ON public.alertas_uso
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_alertas_uso_mes ON public.alertas_uso (mes_ano, disparado_em DESC);

-- ============================================================
-- Storage por usuário (bytes) — SECURITY DEFINER para ler storage.objects
-- ============================================================
CREATE OR REPLACE FUNCTION public.storage_bytes_by_user(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint
  FROM storage.objects o
  JOIN public.documentos d ON d.storage_path = o.name
  JOIN public.condominios c ON c.id = d.condominio_id
  WHERE o.bucket_id = 'documentos'
    AND c.owner_id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.storage_bytes_by_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_bytes_by_user(uuid) TO service_role;

-- ============================================================
-- Recalcular custos_cliente_mensal para um usuário/mês
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_custos_cliente_mensal(_user_id uuid, _mes_ano date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mes text := to_char(_mes_ano, 'YYYY-MM');
  _msgs int := 0;
  _tokens int := 0;
  _custo_io numeric := 0;
  _bytes bigint := 0;
  _custo_storage numeric := 0;
  _mb_rate numeric := 0.0001;
BEGIN
  SELECT COALESCE(total_mensagens,0), COALESCE(total_tokens,0), COALESCE(custo_estimado_brl,0)
    INTO _msgs, _tokens, _custo_io
    FROM public.uso_mensal
    WHERE user_id = _user_id AND mes_ano = _mes;

  SELECT public.storage_bytes_by_user(_user_id) INTO _bytes;
  SELECT custo_storage_mb_brl INTO _mb_rate FROM public.config_alertas WHERE id = 1;
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
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_custos_cliente_mensal(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_custos_cliente_mensal(uuid, date) TO service_role;

-- ============================================================
-- Verificar e disparar alertas de uso
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_alertas_uso(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mes text := to_char(now(), 'YYYY-MM');
  _limite_msgs int;
  _limite_storage_mb int;
  _msgs int := 0;
  _bytes bigint := 0;
  _mb numeric := 0;
  _pct_msgs numeric := 0;
  _pct_storage numeric := 0;
  _thresholds int[];
  _t int;
BEGIN
  SELECT thresholds INTO _thresholds FROM public.config_alertas WHERE id = 1;
  IF _thresholds IS NULL THEN _thresholds := ARRAY[50,80,100]; END IF;

  SELECT p.limite_mensagens_mes, p.limite_storage_mb
    INTO _limite_msgs, _limite_storage_mb
    FROM public.subscriptions s
    JOIN public.planos p ON p.id = s.plano_id
    WHERE s.user_id = _user_id
    LIMIT 1;

  SELECT COALESCE(total_mensagens,0) INTO _msgs
    FROM public.uso_mensal WHERE user_id = _user_id AND mes_ano = _mes;

  SELECT public.storage_bytes_by_user(_user_id) INTO _bytes;
  _mb := _bytes::numeric / 1048576.0;

  IF _limite_msgs IS NOT NULL AND _limite_msgs > 0 THEN
    _pct_msgs := (_msgs::numeric / _limite_msgs::numeric) * 100;
    FOREACH _t IN ARRAY _thresholds LOOP
      IF _pct_msgs >= _t THEN
        INSERT INTO public.alertas_uso (user_id, mes_ano, tipo, threshold_pct, percentual_atingido)
        VALUES (_user_id, _mes, 'mensagens', _t, _pct_msgs)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF _limite_storage_mb IS NOT NULL AND _limite_storage_mb > 0 THEN
    _pct_storage := (_mb / _limite_storage_mb::numeric) * 100;
    FOREACH _t IN ARRAY _thresholds LOOP
      IF _pct_storage >= _t THEN
        INSERT INTO public.alertas_uso (user_id, mes_ano, tipo, threshold_pct, percentual_atingido)
        VALUES (_user_id, _mes, 'storage', _t, _pct_storage)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_alertas_uso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_alertas_uso(uuid) TO service_role;

-- ============================================================
-- Trigger em mensagens (assistant) → check alertas
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_mensagens_check_alertas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NEW.papel <> 'assistant' THEN RETURN NEW; END IF;
  SELECT user_id INTO _uid FROM public.conversas WHERE id = NEW.conversa_id;
  IF _uid IS NOT NULL THEN
    PERFORM public.check_alertas_uso(_uid);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_mensagens_check_alertas ON public.mensagens;
CREATE TRIGGER tg_mensagens_check_alertas
  AFTER INSERT ON public.mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_mensagens_check_alertas();
