CREATE TABLE public.assembleia_votos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.assembleia_itens(id) ON DELETE CASCADE,
    unidade_id uuid REFERENCES public.unidades(id),
    opcao_id uuid NOT NULL REFERENCES public.assembleia_opcoes(id),
    peso numeric NOT NULL,
    base_calculo text NOT NULL CHECK (base_calculo IN ('unidade', 'fracao_ideal')),
    origem text NOT NULL CHECK (origem IN ('portal', 'manual_mesa', 'cabine_mesa')),
    lancado_por uuid,
    justificativa_manual text,
    ip inet,
    user_agent text,
    device_hash text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    recibo text NOT NULL UNIQUE,
    sequencia bigserial,
    hash_anterior text,
    hash_voto text,
    invalidado_em timestamptz,
    invalidado_motivo text,
    invalidado_por uuid,
    CHECK (origem != 'manual_mesa' OR justificativa_manual IS NOT NULL)
);

CREATE UNIQUE INDEX idx_assembleia_votos_item_unidade ON public.assembleia_votos(item_id, unidade_id) 
WHERE unidade_id IS NOT NULL AND invalidado_em IS NULL;

CREATE TABLE public.assembleia_votos_controle (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.assembleia_itens(id) ON DELETE CASCADE,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id),
    criado_minuto timestamptz NOT NULL,
    UNIQUE (item_id, unidade_id)
);

CREATE TABLE public.assembleia_tentativas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    item_id uuid,
    unidade_id uuid,
    email_tentativa text,
    motivo text NOT NULL CHECK (motivo IN ('inadimplente', 'ja_votou', 'fora_janela', 'sem_habilitacao', 'token_invalido', 'token_expirado', 'limite_procuracao', 'item_secreto_manual_negado', 'email_nao_encontrado', 'rate_limit', 'voto_anulado_pela_mesa')),
    detalhe text,
    ip inet,
    user_agent text,
    criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assembleia_resultados (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL UNIQUE REFERENCES public.assembleia_itens(id) ON DELETE CASCADE,
    total_aptos numeric NOT NULL,
    total_votantes numeric NOT NULL,
    votos jsonb NOT NULL,
    vencedora_opcao_id uuid,
    aprovado boolean,
    quorum_exigido numeric NOT NULL,
    quorum_atingido numeric NOT NULL,
    base_calculo text NOT NULL,
    empate boolean NOT NULL DEFAULT false,
    apurado_em timestamptz NOT NULL DEFAULT now(),
    apurado_por uuid,
    hash_resultado text NOT NULL
);

GRANT SELECT ON public.assembleia_votos TO authenticated;
GRANT ALL ON public.assembleia_votos TO service_role;
GRANT ALL ON public.assembleia_votos_controle TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_tentativas TO authenticated;
GRANT ALL ON public.assembleia_tentativas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_resultados TO authenticated;
GRANT ALL ON public.assembleia_resultados TO service_role;

ALTER TABLE public.assembleia_votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_votos_controle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembleia_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view finalized votes" ON public.assembleia_votos FOR SELECT TO authenticated 
USING (public.is_super_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.assembleia_itens WHERE id = item_id AND situacao = 'encerrado'));
CREATE POLICY "Super admins can manage tentativas" ON public.assembleia_tentativas FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can manage resultados" ON public.assembleia_resultados FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
