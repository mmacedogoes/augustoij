
-- 1) Tabela de modelos de checklist
CREATE TABLE public.checklist_templates_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_checklist text NOT NULL CHECK (tipo_checklist IN ('fiscalizacao','pagamento','trabalhista')),
  tipo_servico_slug text,
  descricao text NOT NULL,
  base_legal text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.checklist_templates_itens TO authenticated;
GRANT ALL ON public.checklist_templates_itens TO service_role;

ALTER TABLE public.checklist_templates_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates_itens super admin"
  ON public.checklist_templates_itens
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_checklist_templates_itens_tipo
  ON public.checklist_templates_itens (tipo_checklist, tipo_servico_slug, ordem);

-- 2) Remove IRRF do catálogo e vínculos
DELETE FROM public.tipos_servico_retencoes
 WHERE retencao_id IN (SELECT id FROM public.retencoes_config WHERE slug = 'irrf_servicos');

DELETE FROM public.retencoes_config WHERE slug = 'irrf_servicos';

-- 3) Seeds
INSERT INTO public.checklist_templates_itens (tipo_checklist, tipo_servico_slug, descricao, base_legal, ordem) VALUES
('pagamento', NULL, 'Nota fiscal do período recebida e conferida (competência, CNPJ ou CPF e descrição dos serviços corretos)', NULL, 1),
('pagamento', NULL, 'Valor da nota conforme o contrato, com aditivos e reajustes aplicados', NULL, 2),
('pagamento', NULL, 'Retenções tributárias sinalizadas para este contrato verificadas antes do pagamento', NULL, 3),
('pagamento', NULL, 'Pagamento realizado até o vencimento contratual', NULL, 4),
('pagamento', NULL, 'Comprovante de pagamento arquivado na documentação do condomínio', NULL, 5),

('fiscalizacao', NULL, 'Serviços do período executados conforme o escopo e a frequência contratados', NULL, 1),
('fiscalizacao', NULL, 'Reclamações e ocorrências de moradores sobre o serviço registradas e tratadas com o prestador', NULL, 2),
('fiscalizacao', NULL, 'Obrigações contratuais do período verificadas no mapa de obrigações do contrato', NULL, 3),

('fiscalizacao', 'limpeza_conservacao', 'Cronograma de limpeza das áreas comuns cumprido integralmente', NULL, 10),
('fiscalizacao', 'limpeza_conservacao', 'Materiais e equipamentos fornecidos conforme previsto no contrato', NULL, 11),
('fiscalizacao', 'limpeza_conservacao', 'Equipe presente nos dias e horários contratados', NULL, 12),

('fiscalizacao', 'portaria_controle_acesso', 'Cobertura integral dos postos, sem horários descobertos no período', NULL, 10),
('fiscalizacao', 'portaria_controle_acesso', 'Livro ou sistema de ocorrências preenchido e revisado', NULL, 11),
('fiscalizacao', 'portaria_controle_acesso', 'Procedimentos de controle de acesso de visitantes e prestadores observados', NULL, 12),

('fiscalizacao', 'seguranca_vigilancia', 'Postos de vigilância cobertos conforme a escala contratada', NULL, 10),
('fiscalizacao', 'seguranca_vigilancia', 'Equipamentos previstos em contrato (câmeras, rádios, rondas eletrônicas) em funcionamento', NULL, 11),
('fiscalizacao', 'seguranca_vigilancia', 'Relatório de ocorrências do período recebido', NULL, 12),

('fiscalizacao', 'manutencao_elevadores', 'Manutenção preventiva do mês realizada, com relatório técnico entregue', NULL, 10),
('fiscalizacao', 'manutencao_elevadores', 'Chamados corretivos atendidos dentro do prazo contratual', NULL, 11),
('fiscalizacao', 'manutencao_elevadores', 'ART do responsável técnico e inspeções obrigatórias vigentes conforme a legislação municipal', NULL, 12),

('fiscalizacao', 'piscina_bombas', 'Tratamento químico e limpeza realizados conforme o cronograma', NULL, 10),
('fiscalizacao', 'piscina_bombas', 'Registros de qualidade da água em dia', NULL, 11),

('fiscalizacao', 'dedetizacao', 'Aplicações realizadas conforme o cronograma contratado', NULL, 10),
('fiscalizacao', 'dedetizacao', 'Certificado de execução dos serviços emitido pela empresa', NULL, 11),

('fiscalizacao', 'jardinagem', 'Cronograma de poda, corte e manutenção dos jardins cumprido', NULL, 10),

('fiscalizacao', 'manutencao_predial', 'Ordens de serviço do período executadas e documentadas', NULL, 10),
('fiscalizacao', 'manutencao_predial', 'Relatório técnico das intervenções entregue', NULL, 11),

('fiscalizacao', 'administradora', 'Relatórios gerenciais e prestação de contas do período entregues', NULL, 10),
('fiscalizacao', 'administradora', 'Guias e obrigações do condomínio processadas nos prazos', NULL, 11),

('fiscalizacao', 'contabilidade', 'Balancete do período entregue', NULL, 10),
('fiscalizacao', 'contabilidade', 'Obrigações acessórias do condomínio transmitidas no prazo', NULL, 11),

('fiscalizacao', 'obras_reformas', 'Etapas do cronograma físico da obra cumpridas no período', NULL, 10),
('fiscalizacao', 'obras_reformas', 'Medição ou diário de obra do período aprovado', NULL, 11),
('fiscalizacao', 'obras_reformas', 'ART ou RRT da obra vigente', NULL, 12),

('trabalhista', NULL, 'Folha de pagamento dos empregados alocados no condomínio recebida e conferida', 'Súmula 331 do TST', 1),
('trabalhista', NULL, 'Comprovante de recolhimento do FGTS da competência recebido', 'Lei 8.036/90', 2),
('trabalhista', NULL, 'Comprovante de recolhimento das contribuições previdenciárias da competência recebido', 'Lei 8.212/91', 3),
('trabalhista', NULL, 'CNDT da empresa válida (Certidão Negativa de Débitos Trabalhistas)', 'Lei 12.440/2011', 4),
('trabalhista', NULL, 'CRF do FGTS válido (Certificado de Regularidade)', 'Lei 8.036/90, art. 27', 5),
('trabalhista', NULL, 'Relação atualizada dos empregados alocados no condomínio recebida', 'Súmula 331 do TST', 6),
('trabalhista', NULL, 'Fornecimento e uso de EPIs pelos trabalhadores verificados', 'NR-6', 7),
('trabalhista', NULL, 'Ausência de desvio de função e de acúmulo irregular verificada', NULL, 8),
('trabalhista', NULL, 'Controle de jornada compatível com a escala contratada verificado', NULL, 9);
