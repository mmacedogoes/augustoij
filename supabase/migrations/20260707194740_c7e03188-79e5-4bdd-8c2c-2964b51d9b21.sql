-- Sugestões de unidades extraídas automaticamente de convenções
CREATE TABLE public.sugestoes_unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.documentos(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aplicada','descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sugestoes_unidades_cond_status_idx
  ON public.sugestoes_unidades (condominio_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes_unidades TO authenticated;
GRANT ALL ON public.sugestoes_unidades TO service_role;

ALTER TABLE public.sugestoes_unidades ENABLE ROW LEVEL SECURITY;

-- Dono do condomínio (ou admin) pode ler/gerenciar suas sugestões
CREATE POLICY "Owner reads own sugestoes"
  ON public.sugestoes_unidades FOR SELECT TO authenticated
  USING (
    public.is_condominio_member(condominio_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owner inserts sugestoes"
  ON public.sugestoes_unidades FOR INSERT TO authenticated
  WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Owner updates sugestoes"
  ON public.sugestoes_unidades FOR UPDATE TO authenticated
  USING (public.is_condominio_member(condominio_id, auth.uid()))
  WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Owner deletes sugestoes"
  ON public.sugestoes_unidades FOR DELETE TO authenticated
  USING (public.is_condominio_member(condominio_id, auth.uid()));

CREATE TRIGGER sugestoes_unidades_set_updated_at
  BEFORE UPDATE ON public.sugestoes_unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();