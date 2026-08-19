CREATE TABLE public.assembleia_sessoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    ordem smallint NOT NULL,
    data_hora_inicio timestamptz NOT NULL,
    data_hora_fim timestamptz,
    local text,
    situacao text NOT NULL DEFAULT 'agendada' CHECK (situacao IN ('agendada', 'aberta', 'suspensa', 'encerrada')),
    observacao text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (assembleia_id, ordem)
);

CREATE TABLE public.assembleia_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    ordem smallint NOT NULL,
    titulo text NOT NULL,
    descricao text,
    tipo_votacao text NOT NULL DEFAULT 'sim_nao_abstencao' CHECK (tipo_votacao IN ('sim_nao_abstencao', 'escolha_unica')),
    secreto boolean NOT NULL DEFAULT false,
    base_calculo text CHECK (base_calculo IN ('unidade', 'fracao_ideal')),
    regra_quorum text NOT NULL DEFAULT 'maioria_simples_presentes' CHECK (regra_quorum IN ('maioria_simples_presentes', 'maioria_absoluta_condominos', 'dois_tercos_presentes', 'dois_tercos_condominos', 'tres_quartos_condominos', 'unanimidade', 'personalizado')),
    quorum_valor numeric,
    situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'aberto', 'encerrado', 'adiado', 'prejudicado')),
    sessao_id uuid REFERENCES public.assembleia_sessoes(id),
    aberto_em timestamptz,
    encerrado_em timestamptz,
    fecha_em timestamptz,
    fundamento_legal text,
    alerta_ia jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (assembleia_id, ordem),
    CHECK (regra_quorum != 'personalizado' OR quorum_valor IS NOT NULL)
);

CREATE TABLE public.assembleia_opcoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.assembleia_itens(id) ON DELETE CASCADE,
    ordem smallint NOT NULL,
    rotulo text NOT NULL,
    descricao text,
    natureza text NOT NULL CHECK (natureza IN ('sim', 'nao', 'abstencao', 'alternativa')),
    UNIQUE (item_id, ordem)
);

CREATE TABLE public.assembleia_inadimplencia_importacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    arquivo_path text NOT NULL,
    nome_arquivo text NOT NULL,
    tipo_lista text NOT NULL DEFAULT 'inadimplentes' CHECK (tipo_lista IN ('inadimplentes', 'adimplentes')),
    status text NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'revisao', 'confirmada', 'falhou')),
    resultado_ia jsonb,
    total_linhas int DEFAULT 0,
    total_casadas int DEFAULT 0,
    total_nao_casadas int DEFAULT 0,
    erro text,
    criado_por uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz DEFAULT now(),
    confirmada_em timestamptz
);

CREATE TABLE public.assembleia_inadimplencia_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    importacao_id uuid NOT NULL REFERENCES public.assembleia_inadimplencia_importacoes(id) ON DELETE CASCADE,
    unidade_id uuid REFERENCES public.unidades(id),
    identificador_bruto text,
    nome_bruto text,
    valor_debito numeric,
    inadimplente boolean NOT NULL DEFAULT true,
    confianca numeric CHECK (confianca BETWEEN 0 AND 1),
    ajustado_manualmente boolean NOT NULL DEFAULT false,
    ajustado_por uuid,
    ajustado_em timestamptz,
    observacao text,
    ignorado boolean NOT NULL DEFAULT false
);

CREATE TABLE public.assembleia_habilitacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id),
    apta boolean NOT NULL,
    motivo_bloqueio text CHECK (motivo_bloqueio IN ('inadimplencia', 'sem_condomino_cadastrado', 'decisao_mesa', 'outro')),
    peso_unidade numeric NOT NULL DEFAULT 1,
    peso_fracao numeric,
    origem_dado text NOT NULL CHECK (origem_dado IN ('importacao_ia', 'ajuste_manual', 'cadastro')),
    justificativa text,
    congelado_em timestamptz NOT NULL DEFAULT now(),
    congelado_por uuid,
    UNIQUE (assembleia_id, unidade_id)
);

CREATE TABLE public.assembleia_procuracoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    unidade_outorgante_id uuid NOT NULL REFERENCES public.unidades(id),
    outorgado_tipo text NOT NULL CHECK (outorgado_tipo IN ('condomino', 'terceiro')),
    outorgado_condomino_id uuid REFERENCES public.condominios(id),
    outorgado_nome text NOT NULL,
    outorgado_documento text,
    arquivo_path text,
    situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'validada', 'recusada')),
    motivo_recusa text,
    validada_por uuid,
    validada_em timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.assembleia_presencas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    sessao_id uuid NOT NULL REFERENCES public.assembleia_sessoes(id) ON DELETE CASCADE,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id),
    condomino_id uuid REFERENCES public.condominios(id),
    tipo text NOT NULL CHECK (tipo IN ('presencial', 'remoto', 'procuracao')),
    representante_nome text,
    checkin_em timestamptz NOT NULL DEFAULT now(),
    checkout_em timestamptz,
    origem text NOT NULL CHECK (origem IN ('qr', 'link', 'manual_mesa')),
    ip inet,
    user_agent text,
    UNIQUE (sessao_id, unidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_sessoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_opcoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_inadimplencia_importacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_inadimplencia_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_habilitacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_procuracoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_presencas TO authenticated;

GRANT ALL ON public.assembleia_sessoes TO service_role;
GRANT ALL ON public.assembleia_itens TO service_role;
GRANT ALL ON public.assembleia_opcoes TO service_role;
GRANT ALL ON public.assembleia_inadimplencia_importacoes TO service_role;
GRANT ALL ON public.assembleia_inadimplencia_itens TO service_role;
GRANT ALL ON public.assembleia_habilitacoes TO service_role;
GRANT ALL ON public.assembleia_procuracoes TO service_role;
GRANT ALL ON public.assembleia_presencas TO service_role;

ALTER TABLE public.assembleia_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_inadimplencia_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_inadimplencia_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_habilitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_procuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage assembleia_sessoes" ON public.assembleia_sessoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_itens" ON public.assembleia_itens FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_opcoes" ON public.assembleia_opcoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_inadimplencia_importacoes" ON public.assembleia_inadimplencia_importacoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_inadimplencia_itens" ON public.assembleia_inadimplencia_itens FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_habilitacoes" ON public.assembleia_habilitacoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_procuracoes" ON public.assembleia_procuracoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage assembleia_presencas" ON public.assembleia_presencas FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
