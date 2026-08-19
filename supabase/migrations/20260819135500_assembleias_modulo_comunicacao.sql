-- Tabelas de Convocação e Comunicação

-- Convocantes e Tokens
CREATE TABLE public.assembleia_sessoes_votante (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    condomino_id uuid REFERENCES public.condominios(id),
    email text NOT NULL,
    otp_hash text,
    otp_expira_em timestamptz,
    tentativas_otp int NOT NULL DEFAULT 0,
    token_hash text,
    token_expira_em timestamptz,
    revogado boolean NOT NULL DEFAULT false,
    ip inet,
    user_agent text,
    device_hash text,
    created_at timestamptz DEFAULT now(),
    confirmado_em timestamptz
);

CREATE TABLE public.assembleia_cabine_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.assembleia_itens(id) ON DELETE CASCADE,
    unidade_id uuid NOT NULL,
    token_hash text NOT NULL,
    expira_em timestamptz NOT NULL,
    usado_em timestamptz,
    criado_por uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz DEFAULT now()
);

-- Convocações
CREATE TABLE public.assembleia_convocacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    tipo text NOT NULL DEFAULT 'convocacao' CHECK (tipo IN ('convocacao', 'lembrete_48h', 'lembrete_2h', 'reconvocacao', 'aviso_continuada')),
    assunto_email text,
    corpo_email text,
    corpo_whatsapp text CHECK (length(corpo_whatsapp) <= 900),
    incluir_link_edital boolean NOT NULL DEFAULT true,
    incluir_link_votacao boolean NOT NULL DEFAULT true,
    incluir_link_videoconferencia boolean NOT NULL DEFAULT false,
    situacao text NOT NULL DEFAULT 'rascunho' CHECK (situacao IN ('rascunho', 'pronta', 'em_envio', 'concluida')),
    agendada_para timestamptz,
    enviada_em timestamptz,
    criada_por uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Destinatários
CREATE TABLE public.assembleia_convocacao_destinatarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    convocacao_id uuid NOT NULL REFERENCES public.assembleia_convocacoes(id) ON DELETE CASCADE,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id),
    condomino_id uuid REFERENCES public.condominios(id),
    nome text NOT NULL,
    email text,
    telefone_bruto text,
    telefone_wa text,
    canal text NOT NULL DEFAULT 'sem_contato' CHECK (canal IN ('email', 'whatsapp', 'ambos', 'sem_contato')),
    status_email text NOT NULL DEFAULT 'nao_enviado' CHECK (status_email IN ('nao_enviado', 'enviando', 'enviado', 'entregue', 'aberto', 'falhou')),
    resend_message_id text,
    email_enviado_em timestamptz,
    email_entregue_em timestamptz,
    email_aberto_em timestamptz,
    email_erro text,
    status_whatsapp text NOT NULL DEFAULT 'nao_iniciado' CHECK (status_whatsapp IN ('nao_iniciado', 'link_aberto', 'confirmado')),
    whatsapp_link_aberto_em timestamptz,
    whatsapp_link_aberto_por uuid,
    whatsapp_confirmado_em timestamptz,
    whatsapp_confirmado_por uuid,
    entrega_fisica_protocolo text,
    entrega_fisica_em timestamptz,
    observacao text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (convocacao_id, unidade_id, condomino_id)
);

COMMENT ON COLUMN public.assembleia_convocacao_destinatarios.telefone_wa IS 'Guarda apenas dígitos, com código do país, no formato aceito pela URL do WhatsApp.';

-- Eventos de Convocação
CREATE TABLE public.assembleia_convocacao_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_id uuid NOT NULL REFERENCES public.assembleia_convocacao_destinatarios(id) ON DELETE CASCADE,
    canal text NOT NULL CHECK (canal IN ('email', 'whatsapp')),
    tipo text NOT NULL CHECK (tipo IN ('enfileirado', 'enviado', 'entregue', 'aberto', 'clicado', 'bounce', 'reclamacao', 'falhou', 'link_aberto', 'confirmado_manual', 'entrega_fisica')),
    payload jsonb,
    ocorrido_em timestamptz NOT NULL DEFAULT now(),
    registrado_por uuid
);

-- RLS e Grants
GRANT ALL ON public.assembleia_sessoes_votante TO service_role;
GRANT ALL ON public.assembleia_cabine_tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_convocacoes TO authenticated;
GRANT ALL ON public.assembleia_convocacoes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_convocacao_destinatarios TO authenticated;
GRANT ALL ON public.assembleia_convocacao_destinatarios TO service_role;

GRANT SELECT ON public.assembleia_convocacao_eventos TO authenticated;
GRANT ALL ON public.assembleia_convocacao_eventos TO service_role;

ALTER TABLE public.assembleia_sessoes_votante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_cabine_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_convocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_convocacao_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_convocacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage convocacoes" ON public.assembleia_convocacoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage destinatarios" ON public.assembleia_convocacao_destinatarios FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can view eventos" ON public.assembleia_convocacao_eventos FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

