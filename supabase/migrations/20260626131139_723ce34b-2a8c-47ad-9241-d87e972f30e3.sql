
-- ============================================================
-- FASE 4: Admin + Base de conhecimento (KB) + Orientações
-- ============================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.kb_tipo AS ENUM ('jurisprudencia','doutrina','lei','peca','orientacao','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- admin_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_condominio_id uuid,
  target_kb_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_select_admin"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

-- ============================================================
-- kb_documentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kb_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo public.kb_tipo NOT NULL DEFAULT 'outro',
  fonte text,
  url text,
  storage_path text,
  conteudo_bruto text,
  status_processamento text NOT NULL DEFAULT 'processando',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kb_documentos TO authenticated;
GRANT ALL ON public.kb_documentos TO service_role;

ALTER TABLE public.kb_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_documentos_select_auth"
  ON public.kb_documentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "kb_documentos_admin_write"
  ON public.kb_documentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_kb_documentos_updated_at
  BEFORE UPDATE ON public.kb_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- kb_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_documento_id uuid NOT NULL REFERENCES public.kb_documentos(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kb_chunks TO authenticated;
GRANT ALL ON public.kb_chunks TO service_role;

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_chunks_select_auth"
  ON public.kb_chunks FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
  ON public.kb_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- ai_orientacoes (diretrizes que entram no system prompt)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_orientacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_orientacoes TO authenticated;
GRANT ALL ON public.ai_orientacoes TO service_role;

ALTER TABLE public.ai_orientacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_orientacoes_select_auth"
  ON public.ai_orientacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_orientacoes_admin_write"
  ON public.ai_orientacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_ai_orientacoes_updated_at
  BEFORE UPDATE ON public.ai_orientacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Functions: métricas admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mes text := to_char(now(), 'YYYY-MM');
  _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_usuarios', (SELECT count(*) FROM public.profiles),
    'novos_usuarios_mes', (SELECT count(*) FROM public.profiles WHERE to_char(created_at,'YYYY-MM') = _mes),
    'total_condominios', (SELECT count(*) FROM public.condominios),
    'condominios_ativos_mes', (
      SELECT count(DISTINCT c.condominio_id)
      FROM public.conversas c
      JOIN public.mensagens m ON m.conversa_id = c.id
      WHERE to_char(m.created_at,'YYYY-MM') = _mes
    ),
    'total_documentos', (SELECT count(*) FROM public.documentos),
    'documentos_erro', (SELECT count(*) FROM public.documentos WHERE status_processamento LIKE 'erro%'),
    'mensagens_mes', (SELECT coalesce(sum(total_mensagens),0) FROM public.uso_mensal WHERE mes_ano = _mes),
    'tokens_mes', (SELECT coalesce(sum(total_tokens),0) FROM public.uso_mensal WHERE mes_ano = _mes),
    'custo_estimado_mes', (SELECT coalesce(sum(custo_estimado_brl),0) FROM public.uso_mensal WHERE mes_ano = _mes),
    'kb_total', (SELECT count(*) FROM public.kb_documentos),
    'kb_prontos', (SELECT count(*) FROM public.kb_documentos WHERE status_processamento = 'pronto')
  ) INTO _result;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO authenticated;

-- ============================================================
-- Functions: lista de usuários
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT '', _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  oab text,
  is_admin boolean,
  plano text,
  total_condominios int,
  mensagens_mes int,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _mes text := to_char(now(),'YYYY-MM');
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nome,
    p.email,
    p.oab,
    public.has_role(p.id,'admin') AS is_admin,
    COALESCE((SELECT s.plano::text FROM public.subscriptions s WHERE s.user_id = p.id LIMIT 1), 'trial') AS plano,
    (SELECT count(*)::int FROM public.condominios c WHERE c.owner_id = p.id) AS total_condominios,
    COALESCE((SELECT um.total_mensagens FROM public.uso_mensal um WHERE um.user_id = p.id AND um.mes_ano = _mes), 0) AS mensagens_mes,
    p.created_at
  FROM public.profiles p
  WHERE (_search = '' OR p.email ILIKE '%'||_search||'%' OR p.nome ILIKE '%'||_search||'%')
  ORDER BY p.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int,int) TO authenticated;

-- ============================================================
-- Functions: série temporal de uso
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_usage_timeseries(_days int DEFAULT 30)
RETURNS TABLE (dia date, mensagens int)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT (date_trunc('day', m.created_at))::date AS dia,
         count(*)::int AS mensagens
  FROM public.mensagens m
  WHERE m.created_at >= now() - (_days || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_usage_timeseries(int) TO authenticated;

-- ============================================================
-- Functions: busca na KB global
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  _query_embedding vector(1536),
  _match_count int DEFAULT 4,
  _min_similarity float DEFAULT 0.35
)
RETURNS TABLE (
  chunk_id uuid,
  kb_documento_id uuid,
  titulo text,
  tipo public.kb_tipo,
  fonte text,
  conteudo text,
  similarity float
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.kb_documento_id,
    d.titulo,
    d.tipo,
    d.fonte,
    c.conteudo,
    1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.kb_chunks c
  JOIN public.kb_documentos d ON d.id = c.kb_documento_id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> _query_embedding) >= _min_similarity
  ORDER BY c.embedding <=> _query_embedding
  LIMIT _match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_kb_chunks(vector,int,float) TO authenticated;

-- ============================================================
-- Trigger: custo estimado por mensagem do assistente
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_update_uso_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _mes text;
  _custo numeric;
BEGIN
  IF NEW.papel <> 'assistant' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO _user_id FROM public.conversas WHERE id = NEW.conversa_id;
  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _mes := to_char(now(),'YYYY-MM');
  _custo := COALESCE(NEW.tokens_usados,0) * 0.000015; -- R$/token aproximado

  INSERT INTO public.uso_mensal (user_id, mes_ano, total_mensagens, total_tokens, custo_estimado_brl)
  VALUES (_user_id, _mes, 1, COALESCE(NEW.tokens_usados,0), _custo)
  ON CONFLICT (user_id, mes_ano) DO UPDATE
  SET total_mensagens = public.uso_mensal.total_mensagens + 1,
      total_tokens = public.uso_mensal.total_tokens + COALESCE(NEW.tokens_usados,0),
      custo_estimado_brl = public.uso_mensal.custo_estimado_brl + _custo,
      updated_at = now();

  RETURN NEW;
END;
$$;
