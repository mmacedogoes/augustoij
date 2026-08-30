CREATE TABLE public.unidade_infracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  condomino_id uuid REFERENCES public.condominos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'notificacao',
  categoria text NOT NULL,
  descricao text,
  ocorrido_em timestamptz,
  base_normativa text,
  valor_multa numeric(12,2),
  conversa_id uuid,
  documento_titulo text,
  registrado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unidade_infracoes_tipo_check CHECK (tipo IN ('notificacao','advertencia','multa','comunicado'))
);

CREATE INDEX unidade_infracoes_unidade_idx ON public.unidade_infracoes (unidade_id, created_at DESC);
CREATE INDEX unidade_infracoes_condominio_idx ON public.unidade_infracoes (condominio_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidade_infracoes TO authenticated;
GRANT ALL ON public.unidade_infracoes TO service_role;

ALTER TABLE public.unidade_infracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem infracoes do condominio"
ON public.unidade_infracoes FOR SELECT TO authenticated
USING (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Gestores registram infracoes"
ON public.unidade_infracoes FOR INSERT TO authenticated
WITH CHECK (public.pode_no_condominio(auth.uid(), condominio_id, 'documentos'));

CREATE POLICY "Gestores editam infracoes"
ON public.unidade_infracoes FOR UPDATE TO authenticated
USING (public.pode_no_condominio(auth.uid(), condominio_id, 'documentos'))
WITH CHECK (public.pode_no_condominio(auth.uid(), condominio_id, 'documentos'));

CREATE POLICY "Gestores excluem infracoes"
ON public.unidade_infracoes FOR DELETE TO authenticated
USING (public.pode_no_condominio(auth.uid(), condominio_id, 'documentos'));

CREATE TRIGGER trg_unidade_infracoes_updated_at
BEFORE UPDATE ON public.unidade_infracoes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();