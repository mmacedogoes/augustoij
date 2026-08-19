CREATE TABLE public.assembleia_gravacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    sessao_id uuid NOT NULL REFERENCES public.assembleia_sessoes(id) ON DELETE CASCADE,
    bloco_ordem int NOT NULL,
    arquivo_path text NOT NULL,
    duracao_seg numeric,
    offset_inicio_seg numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'enviando' CHECK (status IN ('enviando', 'enviado', 'transcrevendo', 'transcrito', 'falhou')),
    erro text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (sessao_id, bloco_ordem)
);

CREATE TABLE public.assembleia_transcricoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gravacao_id uuid NOT NULL UNIQUE REFERENCES public.assembleia_gravacoes(id) ON DELETE CASCADE,
    texto text,
    segmentos jsonb,
    modelo text,
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ok', 'falhou')),
    erro text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.assembleia_falantes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    rotulo_ia text NOT NULL,
    nome text,
    unidade_id uuid,
    papel text NOT NULL DEFAULT 'nao_identificado' CHECK (papel IN ('presidente', 'secretario', 'condomino', 'terceiro', 'nao_identificado')),
    UNIQUE (assembleia_id, rotulo_ia)
);

CREATE TABLE public.ata_versoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    numero int NOT NULL,
    situacao text NOT NULL DEFAULT 'rascunho' CHECK (situacao IN ('rascunho', 'revisao', 'publicada')),
    texto_completo text,
    gerada_por text NOT NULL DEFAULT 'ia' CHECK (gerada_por IN ('ia', 'manual')),
    modelo text,
    criada_por uuid,
    publicada_em timestamptz,
    publicada_por uuid,
    hash_publicacao text,
    pdf_path text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (assembleia_id, numero)
);

CREATE TABLE public.ata_blocos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id uuid NOT NULL REFERENCES public.ata_versoes(id) ON DELETE CASCADE,
    ordem int NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('abertura', 'item', 'encerramento', 'livre')),
    item_id uuid,
    texto text NOT NULL,
    origem_audio_inicio numeric,
    origem_audio_fim numeric,
    confianca numeric
);

CREATE TABLE public.ata_lacunas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id uuid NOT NULL REFERENCES public.ata_versoes(id) ON DELETE CASCADE,
    bloco_id uuid REFERENCES public.ata_blocos(id) ON DELETE CASCADE,
    tipo text NOT NULL CHECK (tipo IN ('dado_cadastral', 'nome_nao_identificado', 'valor_incerto', 'deliberacao_sem_votacao', 'fala_inaudivel', 'documento_nao_anexado', 'item_sem_conclusao', 'resultado_pendente')),
    descricao text NOT NULL,
    sugestao text,
    ancora_texto text NOT NULL,
    referencia_audio_seg numeric,
    situacao text NOT NULL DEFAULT 'aberta' CHECK (situacao IN ('aberta', 'preenchida', 'dispensada')),
    valor_preenchido text,
    preenchida_por uuid,
    preenchida_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_gravacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_transcricoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_falantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ata_versoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ata_blocos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ata_lacunas TO authenticated;

GRANT ALL ON public.assembleia_gravacoes TO service_role;
GRANT ALL ON public.assembleia_transcricoes TO service_role;
GRANT ALL ON public.assembleia_falantes TO service_role;
GRANT ALL ON public.ata_versoes TO service_role;
GRANT ALL ON public.ata_blocos TO service_role;
GRANT ALL ON public.ata_lacunas TO service_role;

ALTER TABLE public.assembleia_gravacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_transcricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_falantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ata_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ata_blocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ata_lacunas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage gravacoes" ON public.assembleia_gravacoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage transcricoes" ON public.assembleia_transcricoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage falantes" ON public.assembleia_falantes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage atas" ON public.ata_versoes FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage blocos" ON public.ata_blocos FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage lacunas" ON public.ata_lacunas FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
