-- Módulo de Assembleias - Fase 7: Fila de Fala e Mesa
CREATE TABLE public.assembleia_fila_fala (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assembleia_id uuid NOT NULL REFERENCES public.assembleias(id) ON DELETE CASCADE,
    sessao_id uuid NOT NULL REFERENCES public.assembleia_sessoes(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.assembleia_itens(id) ON DELETE SET NULL,
    unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    condomino_id uuid,
    representante_nome text,
    ordem int NOT NULL,
    situacao text NOT NULL DEFAULT 'aguardando' CHECK (situacao IN ('aguardando', 'falando', 'encerrada', 'desistiu')),
    inscrito_em timestamptz NOT NULL DEFAULT now(),
    iniciou_em timestamptz,
    encerrou_em timestamptz,
    observacao text
);

ALTER TABLE public.assembleia_fila_fala ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage fila_fala"
ON public.assembleia_fila_fala
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assembleia_fila_fala TO authenticated;
GRANT ALL ON public.assembleia_fila_fala TO service_role;

CREATE INDEX idx_assembleia_fila_fala_sessao_ordem ON public.assembleia_fila_fala(sessao_id, ordem);
COMMENT ON TABLE public.assembleia_fila_fala IS 'Gestão da fila de fala em assembleias ao vivo.';
