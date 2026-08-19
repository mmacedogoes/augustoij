CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.assembleia_gerar_recibo()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_bytes bytea := gen_random_bytes(9);
    v_encoded text := encode(v_bytes, 'base64');
BEGIN
    RETURN lower(translate(v_encoded, '/+==', ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_telefone_br(p_telefone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    WITH digits AS (
        SELECT regexp_replace(p_telefone, '\D', '', 'g') as d
    )
    SELECT 
        CASE 
            WHEN d ~ '^55\d{10,11}$' THEN d
            WHEN length(d) IN (10, 11) THEN '55' || d
            ELSE NULL
        END
    FROM digits;
$$;

CREATE TABLE public.assembleias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
    codigo_publico text NOT NULL UNIQUE,
    tipo text NOT NULL CHECK (tipo IN ('ago', 'age', 'mista')),
    titulo text NOT NULL,
    convocacao_numero smallint NOT NULL DEFAULT 1 CHECK (convocacao_numero BETWEEN 1 AND 2),
    data_hora timestamptz NOT NULL,
    local text,
    modalidade text NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'virtual', 'hibrida')),
    situacao text NOT NULL DEFAULT 'rascunho' CHECK (situacao IN ('rascunho', 'convocada', 'habilitacao_pendente', 'instalada', 'suspensa', 'encerrada', 'ata_publicada', 'cancelada')),
    base_calculo_padrao text NOT NULL DEFAULT 'unidade' CHECK (base_calculo_padrao IN ('unidade', 'fracao_ideal')),
    quorum_instalacao_1a numeric NOT NULL DEFAULT 0.6667,
    quorum_instalacao_2a numeric,
    bloqueia_inadimplente boolean NOT NULL DEFAULT true,
    limite_procuracoes_por_outorgado smallint NOT NULL DEFAULT 2,
    permite_voto_manual_mesa boolean NOT NULL DEFAULT true,
    edital_texto text,
    edital_publicado_em timestamptz,
    link_videoconferencia text,
    habilitacao_confirmada_em timestamptz,
    instalada_em timestamptz,
    encerrada_em timestamptz,
    presidente_nome text,
    secretario_nome text,
    criado_por uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.assembleias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage assembleias" ON public.assembleias
    FOR ALL TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
    -- AMPLIAR DEPOIS: trocar por is_condominio_member(condominio_id, auth.uid()) quando o modulo sair do modo restrito.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleias TO authenticated;
GRANT ALL ON public.assembleias TO service_role;

-- RLS policies for storage buckets (assuming they are created)
CREATE POLICY "Super admins can manage assembleia storage" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id IN ('assembleia-planilhas', 'assembleia-gravacoes', 'assembleia-procuracoes') AND public.is_super_admin(auth.uid()))
    WITH CHECK (bucket_id IN ('assembleia-planilhas', 'assembleia-gravacoes', 'assembleia-procuracoes') AND public.is_super_admin(auth.uid()));
