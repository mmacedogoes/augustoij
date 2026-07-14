
-- ============================================================
-- Módulo Administração de Imóveis — schema base
-- ============================================================

-- Utilitário: trigger de updated_at já existe (public.tg_set_updated_at)

-- ---------- proprietarios ----------
CREATE TABLE public.proprietarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  cpf text,
  estado_civil text,
  profissao text,
  rg text,
  email text,
  telefone text,
  endereco text,
  banco text,
  agencia text,
  conta text,
  pix text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proprietarios TO authenticated;
GRANT ALL ON public.proprietarios TO service_role;
ALTER TABLE public.proprietarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere seus proprietarios" ON public.proprietarios
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_proprietarios_owner ON public.proprietarios(owner_admin_id, nome);
CREATE TRIGGER trg_proprietarios_updated
  BEFORE UPDATE ON public.proprietarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- imoveis ----------
CREATE TABLE public.imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  proprietario_id uuid NOT NULL REFERENCES public.proprietarios(id) ON DELETE RESTRICT,
  descricao text,
  endereco text,
  edificio text,
  numero_unidade text,
  cep text,
  cidade text,
  uf text,
  matricula text,
  quartos int,
  vaga_garagem boolean NOT NULL DEFAULT false,
  area numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT ALL ON public.imoveis TO service_role;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere seus imoveis" ON public.imoveis
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_imoveis_owner ON public.imoveis(owner_admin_id, proprietario_id);
CREATE INDEX idx_imoveis_proprietario ON public.imoveis(proprietario_id);
CREATE TRIGGER trg_imoveis_updated
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- contratos_locacao ----------
CREATE TABLE public.contratos_locacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE RESTRICT,
  inquilino_nome text,
  inquilino_cpf text,
  inquilino_estado_civil text,
  inquilino_profissao text,
  inquilino_rg text,
  inquilino_email text,
  inquilino_telefone text,
  inquilino_endereco text,
  valor_aluguel numeric,
  dia_vencimento int CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_contrato_original date,
  data_inicio_vigencia date,
  prazo_meses int,
  indice_reajuste text NOT NULL DEFAULT 'IGP-M',
  periodicidade_reajuste_meses int NOT NULL DEFAULT 12,
  mes_base_reajuste int CHECK (mes_base_reajuste BETWEEN 1 AND 12),
  encargos_inquilino jsonb NOT NULL DEFAULT '{"condominio":true,"agua":true,"luz":true,"iptu":true,"tcr":true}'::jsonb,
  multa_mora_percent numeric NOT NULL DEFAULT 2,
  juros_mora_mensal_percent numeric NOT NULL DEFAULT 1,
  multa_rescisoria_multiplicador numeric NOT NULL DEFAULT 3,
  multa_rescisoria_proporcional boolean NOT NULL DEFAULT true,
  aviso_previo_dias int NOT NULL DEFAULT 30,
  foro text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado','renovado')),
  arquivo_contrato_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_locacao TO authenticated;
GRANT ALL ON public.contratos_locacao TO service_role;
ALTER TABLE public.contratos_locacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere seus contratos de locacao" ON public.contratos_locacao
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_contratos_locacao_owner ON public.contratos_locacao(owner_admin_id, status);
CREATE INDEX idx_contratos_locacao_imovel ON public.contratos_locacao(imovel_id);
CREATE TRIGGER trg_contratos_locacao_updated
  BEFORE UPDATE ON public.contratos_locacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- caucoes ----------
CREATE TABLE public.caucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  contrato_locacao_id uuid NOT NULL UNIQUE REFERENCES public.contratos_locacao(id) ON DELETE CASCADE,
  possui boolean NOT NULL DEFAULT false,
  valor_depositado numeric,
  tipo text CHECK (tipo IN ('poupanca','dinheiro','seguro','outro')),
  corrige_com_rendimento boolean NOT NULL DEFAULT true,
  data_deposito date,
  valor_atual_override numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caucoes TO authenticated;
GRANT ALL ON public.caucoes TO service_role;
ALTER TABLE public.caucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere suas caucoes" ON public.caucoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE TRIGGER trg_caucoes_updated
  BEFORE UPDATE ON public.caucoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- contratos_administracao ----------
CREATE TABLE public.contratos_administracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  proprietario_id uuid NOT NULL REFERENCES public.proprietarios(id) ON DELETE RESTRICT,
  administrador_nome text,
  administrador_documento text,
  administrador_oab text,
  pix_recebimento text,
  banco_recebimento text,
  agencia_recebimento text,
  conta_recebimento text,
  percent_honorario_renovacao numeric NOT NULL DEFAULT 50,
  percent_honorario_mensal numeric NOT NULL DEFAULT 10,
  mora_multa_percent numeric NOT NULL DEFAULT 2,
  mora_juros_mensal_percent numeric NOT NULL DEFAULT 1,
  mora_indice text NOT NULL DEFAULT 'IGP-M',
  data_inicio date,
  prazo_meses int NOT NULL DEFAULT 24,
  status text NOT NULL DEFAULT 'ativo',
  arquivo_contrato_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_administracao TO authenticated;
GRANT ALL ON public.contratos_administracao TO service_role;
ALTER TABLE public.contratos_administracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere contratos de administracao" ON public.contratos_administracao
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_contratos_administracao_owner ON public.contratos_administracao(owner_admin_id, proprietario_id);
CREATE TRIGGER trg_contratos_administracao_updated
  BEFORE UPDATE ON public.contratos_administracao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- pagamentos ----------
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  contrato_locacao_id uuid NOT NULL REFERENCES public.contratos_locacao(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('aluguel','condominio','iptu','agua','luz','tcr','outro')),
  competencia text,
  valor numeric,
  vencimento date,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere pagamentos" ON public.pagamentos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_pagamentos_contrato ON public.pagamentos(contrato_locacao_id, vencimento);
CREATE TRIGGER trg_pagamentos_updated
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- manutencoes ----------
CREATE TABLE public.manutencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  imovel_id uuid NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','em_andamento','concluida','cancelada')),
  responsavel text CHECK (responsavel IN ('proprietario','inquilino','administrador','condominio')),
  custo_estimado numeric,
  custo_final numeric,
  data_solicitacao date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  data_conclusao date,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manutencoes TO authenticated;
GRANT ALL ON public.manutencoes TO service_role;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere manutencoes" ON public.manutencoes
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_manutencoes_imovel ON public.manutencoes(imovel_id, status);
CREATE TRIGGER trg_manutencoes_updated
  BEFORE UPDATE ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- honorarios ----------
CREATE TABLE public.honorarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  contrato_administracao_id uuid NOT NULL REFERENCES public.contratos_administracao(id) ON DELETE CASCADE,
  contrato_locacao_id uuid REFERENCES public.contratos_locacao(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensal','renovacao')),
  competencia text,
  base_calculo numeric,
  percentual numeric,
  valor numeric,
  vencimento date,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.honorarios TO authenticated;
GRANT ALL ON public.honorarios TO service_role;
ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere honorarios" ON public.honorarios
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_honorarios_contrato_adm ON public.honorarios(contrato_administracao_id, vencimento);
CREATE TRIGGER trg_honorarios_updated
  BEFORE UPDATE ON public.honorarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- aditivos ----------
CREATE TABLE public.aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL DEFAULT auth.uid(),
  contrato_locacao_id uuid NOT NULL REFERENCES public.contratos_locacao(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'renovacao',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_url text,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aditivos TO authenticated;
GRANT ALL ON public.aditivos TO service_role;
ALTER TABLE public.aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin gere aditivos" ON public.aditivos
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid());
CREATE INDEX idx_aditivos_contrato ON public.aditivos(contrato_locacao_id);
CREATE TRIGGER trg_aditivos_updated
  BEFORE UPDATE ON public.aditivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
