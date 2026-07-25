
-- ============ Catálogos: leitura authenticated, escrita super admin ============

DROP POLICY IF EXISTS "tipos_servico_contrato_super_admin" ON public.tipos_servico_contrato;
CREATE POLICY "tipos_servico_contrato_read" ON public.tipos_servico_contrato
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tipos_servico_contrato_write" ON public.tipos_servico_contrato
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "retencoes_config_super_admin" ON public.retencoes_config;
CREATE POLICY "retencoes_config_read" ON public.retencoes_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "retencoes_config_write" ON public.retencoes_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tipos_servico_retencoes_super_admin" ON public.tipos_servico_retencoes;
CREATE POLICY "tipos_servico_retencoes_read" ON public.tipos_servico_retencoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tipos_servico_retencoes_write" ON public.tipos_servico_retencoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "checklist_templates_itens super admin" ON public.checklist_templates_itens;
CREATE POLICY "checklist_templates_itens_read" ON public.checklist_templates_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_templates_itens_write" ON public.checklist_templates_itens
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ contratos_servico: dono do condomínio gerencia; super admin lê ============

DROP POLICY IF EXISTS "contratos_servico_super_admin" ON public.contratos_servico;
CREATE POLICY "contratos_servico_owner_all" ON public.contratos_servico
  FOR ALL TO authenticated
  USING (public.is_condominio_member(condominio_id, auth.uid()))
  WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
CREATE POLICY "contratos_servico_super_admin_read" ON public.contratos_servico
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============ Tabelas filhas por contrato_id → contratos_servico ============

DO $$
DECLARE
  t text;
  old_policy text;
BEGIN
  FOR t, old_policy IN
    SELECT * FROM (VALUES
      ('contrato_obrigacoes', 'contrato_obrigacoes_super_admin'),
      ('contrato_responsaveis', 'contrato_responsaveis_super_admin'),
      ('contrato_eventos', 'contrato_eventos_super_admin'),
      ('contrato_checklists', 'contrato_checklists_super_admin'),
      ('contrato_reajustes', 'Super admin manages contrato_reajustes'),
      ('contrato_aditivos', 'aditivos_super_admin_all')
    ) AS v(t, old_policy)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', old_policy, t);
    EXECUTE format($f$
      CREATE POLICY "%s_owner_all" ON public.%I
        FOR ALL TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.contratos_servico cs
          WHERE cs.id = %I.contrato_id
            AND public.is_condominio_member(cs.condominio_id, auth.uid())
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.contratos_servico cs
          WHERE cs.id = %I.contrato_id
            AND public.is_condominio_member(cs.condominio_id, auth.uid())
        ));
    $f$, t, t, t, t);
    EXECUTE format($f$
      CREATE POLICY "%s_super_admin_read" ON public.%I
        FOR SELECT TO authenticated
        USING (public.is_super_admin(auth.uid()));
    $f$, t, t);
  END LOOP;
END $$;

-- Auditoria: escrita continua service-role/definer, leitura para dono + super admin.
DROP POLICY IF EXISTS "auditoria_super_admin_read" ON public.contrato_auditoria;
CREATE POLICY "contrato_auditoria_owner_read" ON public.contrato_auditoria
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contratos_servico cs
    WHERE cs.id = contrato_auditoria.contrato_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ));
CREATE POLICY "contrato_auditoria_super_admin_read" ON public.contrato_auditoria
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============ Tabelas de checklist encadeadas (via checklist_id) ============

DROP POLICY IF EXISTS "contrato_checklist_itens_super_admin" ON public.contrato_checklist_itens;
CREATE POLICY "contrato_checklist_itens_owner_all" ON public.contrato_checklist_itens
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contrato_checklists ck
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE ck.id = contrato_checklist_itens.checklist_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contrato_checklists ck
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE ck.id = contrato_checklist_itens.checklist_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ));
CREATE POLICY "contrato_checklist_itens_super_admin_read" ON public.contrato_checklist_itens
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "contrato_checklist_periodos_super_admin" ON public.contrato_checklist_periodos;
CREATE POLICY "contrato_checklist_periodos_owner_all" ON public.contrato_checklist_periodos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contrato_checklists ck
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE ck.id = contrato_checklist_periodos.checklist_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contrato_checklists ck
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE ck.id = contrato_checklist_periodos.checklist_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ));
CREATE POLICY "contrato_checklist_periodos_super_admin_read" ON public.contrato_checklist_periodos
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "contrato_checklist_marcacoes_super_admin" ON public.contrato_checklist_marcacoes;
CREATE POLICY "contrato_checklist_marcacoes_owner_all" ON public.contrato_checklist_marcacoes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contrato_checklist_itens it
    JOIN public.contrato_checklists ck ON ck.id = it.checklist_id
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE it.id = contrato_checklist_marcacoes.item_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contrato_checklist_itens it
    JOIN public.contrato_checklists ck ON ck.id = it.checklist_id
    JOIN public.contratos_servico cs ON cs.id = ck.contrato_id
    WHERE it.id = contrato_checklist_marcacoes.item_id
      AND public.is_condominio_member(cs.condominio_id, auth.uid())
  ));
CREATE POLICY "contrato_checklist_marcacoes_super_admin_read" ON public.contrato_checklist_marcacoes
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
