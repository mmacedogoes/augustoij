-- Migração: Sincronização de usuários vinculados e replicação de planos da conta master
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS vinculado_a_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_vinculado_a ON public.subscriptions(vinculado_a_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_criado_por ON public.profiles(criado_por);

-- Função de backfill para sincronizar usuários vinculados existentes
DO 
DECLARE
  r RECORD;
  owner_sub RECORD;
BEGIN
  -- Percorre todos os membros vinculados onde criado_por existe e é diferente do próprio usuário
  FOR r IN 
    SELECT DISTINCT cm.user_id, cm.criado_por
    FROM public.condominio_members cm
    WHERE cm.criado_por IS NOT NULL AND cm.criado_por != cm.user_id
  LOOP
    -- Atualiza profile
    UPDATE public.profiles
    SET criado_por = r.criado_por
    WHERE id = r.user_id AND (criado_por IS NULL OR criado_por != r.criado_por);

    -- Busca a subscription do dono
    SELECT * INTO owner_sub
    FROM public.subscriptions
    WHERE user_id = r.criado_por
    LIMIT 1;

    IF FOUND THEN
      -- Replica plano, limites e status do titular na subscription do usuário vinculado
      INSERT INTO public.subscriptions (
        user_id,
        plano_config_id,
        status,
        cortesia,
        cortesia_observacao,
        custom_preco,
        custom_ciclo,
        custom_billing_type,
        custom_vencimento_dias,
        custom_limits,
        vinculado_a_user_id
      ) VALUES (
        r.user_id,
        COALESCE(owner_sub.plano_config_id, 'gestao'),
        'active',
        COALESCE(owner_sub.cortesia, false),
        COALESCE(owner_sub.cortesia_observacao, 'Usuário vinculado'),
        owner_sub.custom_preco,
        owner_sub.custom_ciclo,
        owner_sub.custom_billing_type,
        owner_sub.custom_vencimento_dias,
        owner_sub.custom_limits,
        r.criado_por
      )
      ON CONFLICT (user_id) DO UPDATE SET
        plano_config_id = COALESCE(owner_sub.plano_config_id, 'gestao'),
        status = 'active',
        cortesia = COALESCE(owner_sub.cortesia, false),
        custom_preco = owner_sub.custom_preco,
        custom_ciclo = owner_sub.custom_ciclo,
        custom_billing_type = owner_sub.custom_billing_type,
        custom_vencimento_dias = owner_sub.custom_vencimento_dias,
        custom_limits = owner_sub.custom_limits,
        vinculado_a_user_id = r.criado_por;
    END IF;
  END LOOP;
END ;

-- Atualiza admin_list_users para retornar o plano_config_id correto e os dados do titular vinculado
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT ''::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(
   id uuid,
   nome text,
   email text,
   oab text,
   is_admin boolean,
   ativo boolean,
   plano text,
   plano_config_id text,
   cortesia boolean,
   vinculado_a_id uuid,
   vinculado_a_nome text,
   vinculado_a_email text,
   total_condominios integer,
   mensagens_mes integer,
   created_at timestamp with time zone
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $
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
    COALESCE(
      s.plano_config_id,
      (SELECT s2.plano_config_id FROM public.subscriptions s2 WHERE s2.user_id = p.criado_por),
      'gratuito'
    ) AS plano,
    COALESCE(
      s.plano_config_id,
      (SELECT s2.plano_config_id FROM public.subscriptions s2 WHERE s2.user_id = p.criado_por),
      'gratuito'
    ) AS plano_config_id,
    COALESCE(
      s.cortesia,
      (SELECT s2.cortesia FROM public.subscriptions s2 WHERE s2.user_id = p.criado_por),
      false
    ) AS cortesia,
    p.criado_por AS vinculado_a_id,
    owner_p.nome AS vinculado_a_nome,
    owner_p.email AS vinculado_a_email,
    (SELECT count(*)::int FROM public.condominios c WHERE c.owner_id = p.id) AS total_condominios,
    COALESCE((SELECT um.total_mensagens FROM public.uso_mensal um WHERE um.user_id = p.id AND um.mes_ano = _mes), 0) AS mensagens_mes,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON s.user_id = p.id
  LEFT JOIN public.profiles owner_p ON owner_p.id = p.criado_por
  WHERE (
    _search = ''
    OR p.email ILIKE '%'||_search||'%'
    OR p.nome ILIKE '%'||_search||'%'
    OR COALESCE(p.oab,'') ILIKE '%'||_search||'%'
  )
  ORDER BY p.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon, authenticated;
