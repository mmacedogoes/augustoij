
-- 1) profiles: prevent self-escalation of papel_sistema via trigger
CREATE OR REPLACE FUNCTION public.tg_profiles_prevent_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_super_admin(auth.uid()) THEN
    NEW.papel_sistema := OLD.papel_sistema;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_prevent_self_escalation();

-- Simplify self-update policy (trigger enforces papel_sistema immutability)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2) kb_chunks / kb_documentos: restrict SELECT to admins only
DROP POLICY IF EXISTS kb_chunks_select_auth ON public.kb_chunks;
CREATE POLICY kb_chunks_select_admin ON public.kb_chunks
  FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS kb_documentos_select_auth ON public.kb_documentos;
CREATE POLICY kb_documentos_select_admin ON public.kb_documentos
  FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- 3) Remove internal has_role checks (server functions now call via service role)
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mes text := to_char(now(), 'YYYY-MM');
  _result jsonb;
BEGIN
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_usage_timeseries(_days integer DEFAULT 30)
 RETURNS TABLE(dia date, mensagens integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT (date_trunc('day', m.created_at))::date AS dia,
         count(*)::int AS mensagens
  FROM public.mensagens m
  WHERE m.created_at >= now() - (_days || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT ''::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nome text, email text, oab text, is_admin boolean, ativo boolean, plano text, total_condominios integer, mensagens_mes integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _mes text := to_char(now(),'YYYY-MM');
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nome,
    p.email,
    p.oab,
    public.has_role(p.id,'admin') AS is_admin,
    p.ativo,
    COALESCE((SELECT s.plano::text FROM public.subscriptions s WHERE s.user_id = p.id LIMIT 1), 'trial') AS plano,
    (SELECT count(*)::int FROM public.condominios c WHERE c.owner_id = p.id) AS total_condominios,
    COALESCE((SELECT um.total_mensagens FROM public.uso_mensal um WHERE um.user_id = p.id AND um.mes_ano = _mes), 0) AS mensagens_mes,
    p.created_at
  FROM public.profiles p
  WHERE (
    _search = ''
    OR p.email ILIKE '%'||_search||'%'
    OR p.nome ILIKE '%'||_search||'%'
    OR COALESCE(p.oab,'') ILIKE '%'||_search||'%'
  )
  ORDER BY p.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calcular_custo_mensal(_user_id uuid, _mes_ano date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _mes text := to_char(_mes_ano, 'YYYY-MM');
  _usd_brl numeric := 5.20;
  _in_rate numeric := 0.15 / 1000000;
  _out_rate numeric := 0.60 / 1000000;
  _msgs int; _tokens int; _custo_io numeric;
BEGIN
  SELECT COALESCE(total_mensagens,0), COALESCE(total_tokens,0) INTO _msgs, _tokens
    FROM public.uso_mensal WHERE user_id = _user_id AND mes_ano = _mes;
  _custo_io := COALESCE(_tokens,0) * ((_in_rate + _out_rate)/2) * _usd_brl;
  RETURN jsonb_build_object(
    'mes_ano', _mes, 'total_mensagens', COALESCE(_msgs,0), 'total_tokens', COALESCE(_tokens,0),
    'custo_tokens_brl', _custo_io, 'custo_embeddings_brl', 0, 'custo_storage_brl', 0, 'usd_brl', _usd_brl);
END;
$function$;

-- Revoke EXECUTE from authenticated/PUBLIC on admin-only SECURITY DEFINER functions.
-- Callers use the service role via server functions after ensureAdmin().
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_usage_timeseries(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_custo_mensal(uuid, date) FROM PUBLIC, anon, authenticated;
