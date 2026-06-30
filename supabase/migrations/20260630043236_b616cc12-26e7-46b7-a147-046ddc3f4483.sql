
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.admin_list_users(text, int, int);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT '',
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  oab text,
  is_admin boolean,
  ativo boolean,
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
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int,int) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='condominios' AND policyname='admin_select_all_condominios'
  ) THEN
    CREATE POLICY admin_select_all_condominios ON public.condominios
      FOR SELECT TO authenticated
      USING (public.is_any_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='documentos' AND policyname='admin_select_all_documentos'
  ) THEN
    CREATE POLICY admin_select_all_documentos ON public.documentos
      FOR SELECT TO authenticated
      USING (public.is_any_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversas' AND policyname='admin_select_all_conversas'
  ) THEN
    CREATE POLICY admin_select_all_conversas ON public.conversas
      FOR SELECT TO authenticated
      USING (public.is_any_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='mensagens' AND policyname='admin_select_all_mensagens'
  ) THEN
    CREATE POLICY admin_select_all_mensagens ON public.mensagens
      FOR SELECT TO authenticated
      USING (public.is_any_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='condominio_members' AND policyname='admin_select_all_members'
  ) THEN
    CREATE POLICY admin_select_all_members ON public.condominio_members
      FOR SELECT TO authenticated
      USING (public.is_any_admin(auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='unidades') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='unidades' AND policyname='admin_select_all_unidades'
    ) THEN
      CREATE POLICY admin_select_all_unidades ON public.unidades
        FOR SELECT TO authenticated
        USING (public.is_any_admin(auth.uid()));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='condominos') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='condominos' AND policyname='admin_select_all_condominos'
    ) THEN
      CREATE POLICY admin_select_all_condominos ON public.condominos
        FOR SELECT TO authenticated
        USING (public.is_any_admin(auth.uid()));
    END IF;
  END IF;
END $$;
