
-- ============================================================
-- 1) DESPESAS: isolamento por tenant admin
-- ============================================================
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS owner_admin_id uuid;

-- Backfill: usa created_by se for super_admin; senão pega o primeiro super_admin existente.
UPDATE public.despesas d
   SET owner_admin_id = d.created_by
 WHERE owner_admin_id IS NULL
   AND d.created_by IS NOT NULL
   AND public.is_super_admin(d.created_by);

-- Para linhas sem created_by válido, deixa NULL (política vai bloquear leitura até serem atribuídas manualmente).

DROP POLICY IF EXISTS despesas_super_admin ON public.despesas;
DROP POLICY IF EXISTS "despesas_super_admin" ON public.despesas;

CREATE POLICY despesas_owner_admin_all
  ON public.despesas
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());

-- ============================================================
-- 2) REAJUSTES: exigir owner_admin_id = auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "reajustes super admin" ON public.reajustes;
DROP POLICY IF EXISTS reajustes_super_admin ON public.reajustes;

CREATE POLICY reajustes_owner_admin_all
  ON public.reajustes
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());

-- ============================================================
-- 3) ALERTAS_USO: escrita admin restrita ao próprio usuário-alvo
--    (o usuário mantém leitura/escrita dos próprios alertas via política existente
--     'alertas_uso_select_own_or_admin'; a política de escrita admin fica restrita
--     ao próprio user_id — super admins escrevem via server function/service role.)
-- ============================================================
DROP POLICY IF EXISTS alertas_uso_super_write ON public.alertas_uso;

CREATE POLICY alertas_uso_write_own
  ON public.alertas_uso
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4) AI_ORIENTACOES: leitura restrita a super_admin
-- ============================================================
DROP POLICY IF EXISTS ai_orientacoes_select_auth ON public.ai_orientacoes;
DROP POLICY IF EXISTS ai_orientacoes_admin_write ON public.ai_orientacoes;

CREATE POLICY ai_orientacoes_super_read
  ON public.ai_orientacoes
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY ai_orientacoes_super_write
  ON public.ai_orientacoes
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- 5) REVOKE EXECUTE em funções administrativas / internas
--    (Ficam disponíveis apenas para service_role, chamadas via server functions
--     com supabaseAdmin após verificação de papel.)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_metrics()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_usage_timeseries(integer)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_custo_mensal(uuid, date)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_custos_cliente_mensal(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.storage_bytes_by_user(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_alertas_uso(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM PUBLIC, anon, authenticated;

-- Triggers (só devem rodar como trigger, nunca via RPC):
REVOKE EXECUTE ON FUNCTION public.tg_eventos_ia_agrega()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_prevent_self_escalation()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_mensagens_check_alertas()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_update_uso_mensal()                 FROM PUBLIC, anon, authenticated;

-- (Mantidas executáveis por authenticated pois são usadas em RLS:
--  has_role, has_papel_sistema, is_super_admin, is_any_admin,
--  is_condominio_member, match_document_chunks, match_kb_chunks.)

-- ============================================================
-- 6) search_path fixo em funções SQL utilitárias
-- ============================================================
ALTER FUNCTION public.normalize_cpf(text)       SET search_path = public;
ALTER FUNCTION public.normalize_unidade(text)   SET search_path = public;
ALTER FUNCTION public.normalize_edificio(text)  SET search_path = public;
