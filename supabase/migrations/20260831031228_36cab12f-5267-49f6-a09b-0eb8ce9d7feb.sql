ALTER TABLE public.sugestoes_unidades
  DROP CONSTRAINT IF EXISTS sugestoes_unidades_status_check;

ALTER TABLE public.sugestoes_unidades
  ADD CONSTRAINT sugestoes_unidades_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'pendente_revisao'::text,
    'aplicada'::text,
    'descartada'::text,
    'falhou'::text
  ]));

CREATE TABLE public.perfis_documentais_condominio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL UNIQUE REFERENCES public.condominios(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  escala_fracao text,
  regra_area text,
  tolerancias jsonb NOT NULL DEFAULT '{}'::jsonb,
  validacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  diagnostico jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_documentais_condominio TO authenticated;
GRANT ALL ON public.perfis_documentais_condominio TO service_role;

ALTER TABLE public.perfis_documentais_condominio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros leem perfil documental"
ON public.perfis_documentais_condominio
FOR SELECT TO authenticated
USING (
  public.is_condominio_member(condominio_id, auth.uid())
  OR public.is_any_admin(auth.uid())
);

CREATE POLICY "Membros criam perfil documental"
ON public.perfis_documentais_condominio
FOR INSERT TO authenticated
WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Membros atualizam perfil documental"
ON public.perfis_documentais_condominio
FOR UPDATE TO authenticated
USING (public.is_condominio_member(condominio_id, auth.uid()))
WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Dono exclui perfil documental"
ON public.perfis_documentais_condominio
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.condominios c
    WHERE c.id = condominio_id
      AND public.conta_master(c.owner_id) = public.conta_master(auth.uid())
  )
);

CREATE TRIGGER perfis_documentais_condominio_updated_at
BEFORE UPDATE ON public.perfis_documentais_condominio
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX perfis_documentais_documento_idx
ON public.perfis_documentais_condominio(documento_id);

CREATE OR REPLACE FUNCTION public.aplicar_unidades_extraidas(
  p_condominio_id uuid,
  p_linhas jsonb,
  p_estrategia text DEFAULT 'preencher'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_id uuid;
  v_bloco text;
  v_numero text;
  v_tipo public.tipo_unidade;
  v_fracao numeric;
  v_area numeric;
  v_vagas integer;
  v_criadas integer := 0;
  v_atualizadas integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_estrategia NOT IN ('manter', 'preencher') THEN
    RAISE EXCEPTION 'A importação documental não pode substituir dados existentes';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.condominios c
    WHERE c.id = p_condominio_id
      AND (
        c.owner_id = auth.uid()
        OR public.conta_master(c.owner_id) = public.conta_master(auth.uid())
        OR public.is_condominio_member(c.id, auth.uid())
        OR public.is_any_admin(auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para este condomínio';
  END IF;
  IF jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN
    RAISE EXCEPTION 'Nenhuma unidade para importar';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_linhas)
  LOOP
    v_bloco := nullif(btrim(v_item->>'bloco'), '');
    v_numero := nullif(btrim(v_item->>'numero'), '');
    IF v_numero IS NULL THEN RAISE EXCEPTION 'Unidade sem número'; END IF;
    v_tipo := COALESCE(nullif(v_item->>'tipo_unidade', '')::public.tipo_unidade, 'apartamento'::public.tipo_unidade);
    v_fracao := nullif(v_item->>'fracao_ideal', '')::numeric;
    v_area := nullif(v_item->>'area_m2', '')::numeric;
    v_vagas := COALESCE(nullif(v_item->>'vagas_garagem', '')::integer, 0);

    SELECT id INTO v_id FROM public.unidades
    WHERE condominio_id = p_condominio_id
      AND coalesce(lower(btrim(bloco)), '') = coalesce(lower(v_bloco), '')
      AND btrim(numero) = v_numero
    FOR UPDATE;

    IF v_id IS NULL THEN
      INSERT INTO public.unidades (condominio_id, bloco, numero, tipo, fracao_ideal, area_m2, vagas_garagem)
      VALUES (p_condominio_id, v_bloco, v_numero, v_tipo, v_fracao, v_area, v_vagas);
      v_criadas := v_criadas + 1;
    ELSIF p_estrategia = 'preencher' THEN
      UPDATE public.unidades SET
        fracao_ideal = CASE WHEN fracao_ideal IS NULL THEN v_fracao ELSE fracao_ideal END,
        area_m2 = CASE WHEN area_m2 IS NULL THEN v_area ELSE area_m2 END,
        vagas_garagem = CASE WHEN coalesce(vagas_garagem, 0) = 0 THEN v_vagas ELSE vagas_garagem END,
        updated_at = now()
      WHERE id = v_id AND (
        (fracao_ideal IS NULL AND v_fracao IS NOT NULL)
        OR (area_m2 IS NULL AND v_area IS NOT NULL)
        OR (coalesce(vagas_garagem, 0) = 0 AND v_vagas > 0)
      );
      IF FOUND THEN v_atualizadas := v_atualizadas + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'unidadesCriadas', v_criadas,
    'unidadesAtualizadas', v_atualizadas,
    'condominosCriados', 0,
    'erros', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_unidades_extraidas(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid, jsonb, text) TO service_role;