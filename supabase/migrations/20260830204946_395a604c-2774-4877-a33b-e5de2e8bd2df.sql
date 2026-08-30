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
  IF p_estrategia NOT IN ('manter', 'preencher', 'substituir') THEN
    RAISE EXCEPTION 'Estratégia de importação inválida';
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
    ELSIF p_estrategia = 'substituir' THEN
      UPDATE public.unidades SET tipo=v_tipo, fracao_ideal=v_fracao, area_m2=v_area,
        vagas_garagem=v_vagas, updated_at=now() WHERE id=v_id;
      v_atualizadas := v_atualizadas + 1;
    ELSIF p_estrategia = 'preencher' THEN
      UPDATE public.unidades SET
        fracao_ideal=CASE WHEN fracao_ideal IS NULL THEN v_fracao ELSE fracao_ideal END,
        area_m2=CASE WHEN area_m2 IS NULL THEN v_area ELSE area_m2 END,
        vagas_garagem=CASE WHEN coalesce(vagas_garagem,0)=0 THEN v_vagas ELSE vagas_garagem END,
        updated_at=now()
      WHERE id=v_id AND ((fracao_ideal IS NULL AND v_fracao IS NOT NULL)
        OR (area_m2 IS NULL AND v_area IS NOT NULL)
        OR (coalesce(vagas_garagem,0)=0 AND v_vagas>0));
      IF FOUND THEN v_atualizadas := v_atualizadas + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('unidadesCriadas',v_criadas,'unidadesAtualizadas',v_atualizadas,'condominosCriados',0,'erros','[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.aplicar_unidades_extraidas(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_unidades_extraidas(uuid,jsonb,text) TO service_role;