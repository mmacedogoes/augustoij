
-- ============================================================================
-- FASE 1 | Módulo de Contratos de Prestação de Serviços — fundação
-- ============================================================================

-- ---------- Catálogos de parametrização --------------------------------------

CREATE TABLE public.tipos_servico_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  terceirizacao_padrao boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tipos_servico_contrato TO authenticated;
GRANT ALL ON public.tipos_servico_contrato TO service_role;
ALTER TABLE public.tipos_servico_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY tipos_servico_contrato_super_admin ON public.tipos_servico_contrato
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.retencoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  aliquota_referencia text,
  base_legal text,
  descricao text,
  ativo_padrao boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.retencoes_config TO authenticated;
GRANT ALL ON public.retencoes_config TO service_role;
ALTER TABLE public.retencoes_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY retencoes_config_super_admin ON public.retencoes_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.tipos_servico_retencoes (
  tipo_servico_id uuid NOT NULL REFERENCES public.tipos_servico_contrato(id) ON DELETE CASCADE,
  retencao_id uuid NOT NULL REFERENCES public.retencoes_config(id) ON DELETE CASCADE,
  aplica_por_padrao boolean NOT NULL DEFAULT true,
  observacao text,
  PRIMARY KEY (tipo_servico_id, retencao_id)
);
GRANT SELECT ON public.tipos_servico_retencoes TO authenticated;
GRANT ALL ON public.tipos_servico_retencoes TO service_role;
ALTER TABLE public.tipos_servico_retencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tipos_servico_retencoes_super_admin ON public.tipos_servico_retencoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- Contrato principal ----------------------------------------------

CREATE TABLE public.contratos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  tipo_servico_id uuid REFERENCES public.tipos_servico_contrato(id),
  situacao text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','suspenso','encerrado')),
  prestador_nome text NOT NULL,
  prestador_documento text,
  prestador_email text,
  prestador_telefone text,
  objeto text,
  terceirizacao_mao_de_obra boolean NOT NULL DEFAULT false,
  data_inicio date,
  prazo_indeterminado boolean NOT NULL DEFAULT false,
  data_fim date,
  renovacao_automatica boolean NOT NULL DEFAULT false,
  aviso_previo_dias int,
  valor numeric,
  tipo_valor text NOT NULL DEFAULT 'mensal' CHECK (tipo_valor IN ('mensal','global')),
  dia_vencimento int CHECK (dia_vencimento BETWEEN 1 AND 31),
  indice_reajuste text DEFAULT 'igpm' CHECK (indice_reajuste IN ('igpm','ipca','inpc','outro','nenhum')),
  mes_base_reajuste int CHECK (mes_base_reajuste BETWEEN 1 AND 12),
  multa_rescisoria text,
  exige_seguro_rc boolean NOT NULL DEFAULT false,
  garantias text,
  foro text,
  arquivo_path text,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  notificacoes_ativas boolean NOT NULL DEFAULT true,
  encerrado_em date,
  motivo_encerramento text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contratos_servico_condominio ON public.contratos_servico(condominio_id);
CREATE INDEX idx_contratos_servico_data_fim ON public.contratos_servico(data_fim);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_servico TO authenticated;
GRANT ALL ON public.contratos_servico TO service_role;
ALTER TABLE public.contratos_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY contratos_servico_super_admin ON public.contratos_servico
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_contratos_servico_updated_at
  BEFORE UPDATE ON public.contratos_servico
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Responsáveis (tabela dorme nesta fase) ---------------------------

CREATE TABLE public.contrato_responsaveis (
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contrato_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_responsaveis TO authenticated;
GRANT ALL ON public.contrato_responsaveis TO service_role;
ALTER TABLE public.contrato_responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_responsaveis_super_admin ON public.contrato_responsaveis
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- Obrigações (usadas já nesta fase) --------------------------------

CREATE TABLE public.contrato_obrigacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  parte text NOT NULL CHECK (parte IN ('condominio','prestador')),
  descricao text NOT NULL,
  periodicidade text NOT NULL DEFAULT 'mensal' CHECK (periodicidade IN ('unica','mensal','trimestral','semestral','anual','por_evento')),
  clausula_origem text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','ia')),
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_obrigacoes TO authenticated;
GRANT ALL ON public.contrato_obrigacoes TO service_role;
ALTER TABLE public.contrato_obrigacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_obrigacoes_super_admin ON public.contrato_obrigacoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_contrato_obrigacoes_updated_at
  BEFORE UPDATE ON public.contrato_obrigacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Checklists (dormem nesta fase) -----------------------------------

CREATE TABLE public.contrato_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('fiscalizacao','pagamento','tributario','trabalhista')),
  titulo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_checklists TO authenticated;
GRANT ALL ON public.contrato_checklists TO service_role;
ALTER TABLE public.contrato_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_checklists_super_admin ON public.contrato_checklists
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.contrato_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.contrato_checklists(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  base_legal text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_checklist_itens TO authenticated;
GRANT ALL ON public.contrato_checklist_itens TO service_role;
ALTER TABLE public.contrato_checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_checklist_itens_super_admin ON public.contrato_checklist_itens
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.contrato_checklist_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.contrato_checklists(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','concluido')),
  UNIQUE (checklist_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_checklist_periodos TO authenticated;
GRANT ALL ON public.contrato_checklist_periodos TO service_role;
ALTER TABLE public.contrato_checklist_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_checklist_periodos_super_admin ON public.contrato_checklist_periodos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.contrato_checklist_marcacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.contrato_checklist_periodos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.contrato_checklist_itens(id) ON DELETE CASCADE,
  situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','conforme','nao_conforme','nao_se_aplica')),
  observacao text,
  marcado_por uuid,
  marcado_em timestamptz,
  UNIQUE (periodo_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_checklist_marcacoes TO authenticated;
GRANT ALL ON public.contrato_checklist_marcacoes TO service_role;
ALTER TABLE public.contrato_checklist_marcacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_checklist_marcacoes_super_admin ON public.contrato_checklist_marcacoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- Eventos (dorme nesta fase) ---------------------------------------

CREATE TABLE public.contrato_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_servico(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('fim_vigencia','janela_denuncia','reajuste','pagamento','checklist_pendente','manual')),
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido','cancelado')),
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contrato_eventos_data ON public.contrato_eventos(data_evento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_eventos TO authenticated;
GRANT ALL ON public.contrato_eventos TO service_role;
ALTER TABLE public.contrato_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrato_eventos_super_admin ON public.contrato_eventos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- Seeds ------------------------------------------------------------

INSERT INTO public.tipos_servico_contrato (slug, nome, terceirizacao_padrao, ordem) VALUES
('portaria_controle_acesso','Portaria e controle de acesso',true,1),
('seguranca_vigilancia','Segurança e vigilância',true,2),
('limpeza_conservacao','Limpeza e conservação',true,3),
('jardinagem','Jardinagem',true,4),
('manutencao_elevadores','Manutenção de elevadores',false,5),
('manutencao_predial','Manutenção predial',false,6),
('piscina_bombas','Piscina e bombas',false,7),
('dedetizacao','Dedetização e controle de pragas',false,8),
('administradora','Administradora',false,9),
('contabilidade','Contabilidade',false,10),
('assessoria_juridica','Assessoria jurídica',false,11),
('seguros','Seguros',false,12),
('obras_reformas','Obras e reformas',false,13),
('energia_gas','Energia e gás',false,14),
('telecom_internet','Telecomunicações e internet',false,15),
('outros','Outros',false,16);

INSERT INTO public.retencoes_config (slug, nome, aliquota_referencia, base_legal, descricao, ativo_padrao) VALUES
('inss_cessao_mao_de_obra','INSS retido (cessão de mão de obra)','11% sobre o valor bruto da nota','Art. 31 da Lei 8.212/91 c/c art. 15, parágrafo único','Retenção obrigatória pelo condomínio tomador quando o serviço envolve cessão de mão de obra, com trabalhadores colocados à disposição nas dependências.',true),
('iss_retido','ISS retido na fonte','Conforme a lei do município','LC 116/2003 e legislação municipal','Verificar se a lei do município do condomínio atribui ao tomador a responsabilidade pela retenção do ISS para este tipo de serviço.',true),
('irrf_servicos','IRRF sobre serviços','Conforme tabela ou alíquota aplicável','Regulamento do Imposto de Renda','Atenção especial a pagamentos feitos a pessoa física. Confirmar as hipóteses aplicáveis com a assessoria contábil.',true),
('csrf_pis_cofins_csll','CSRF (PIS, COFINS e CSLL)','4,65%','Art. 30 da Lei 10.833/2003','Em regra, condomínio não é pessoa jurídica e tende a não se sujeitar a esta retenção. Item desativado por padrão; habilite apenas com orientação específica.',false);

INSERT INTO public.tipos_servico_retencoes (tipo_servico_id, retencao_id)
SELECT t.id, r.id
FROM public.tipos_servico_contrato t
CROSS JOIN public.retencoes_config r
WHERE r.slug = 'inss_cessao_mao_de_obra' AND t.terceirizacao_padrao = true;

INSERT INTO public.tipos_servico_retencoes (tipo_servico_id, retencao_id)
SELECT t.id, r.id
FROM public.tipos_servico_contrato t
CROSS JOIN public.retencoes_config r
WHERE r.slug = 'iss_retido' AND t.slug IN
('portaria_controle_acesso','seguranca_vigilancia','limpeza_conservacao','jardinagem','manutencao_elevadores','manutencao_predial','piscina_bombas','dedetizacao','administradora','contabilidade','assessoria_juridica','obras_reformas');
