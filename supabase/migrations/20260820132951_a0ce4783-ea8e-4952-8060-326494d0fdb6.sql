CREATE OR REPLACE FUNCTION public.assembleia_registrar_voto(
  p_item_id uuid,
  p_unidade_id uuid,
  p_opcao_id uuid,
  p_peso numeric,
  p_base_calculo text,
  p_origem text,
  p_ip inet,
  p_user_agent text,
  p_device_hash text,
  p_lancado_por uuid DEFAULT NULL,
  p_justificativa text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assembleia_id uuid;
  v_situacao text;
  v_secreto boolean;
  v_fecha_em timestamptz;
  v_apta boolean;
  v_recibo uuid;
  v_horario_voto timestamptz := now();
BEGIN
  -- 1. Obter dados do item e assembleia
  SELECT i.assembleia_id, i.situacao, i.secreto, i.fecha_em 
  INTO v_assembleia_id, v_situacao, v_secreto, v_fecha_em
  FROM public.assembleia_itens i
  WHERE i.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_nao_encontrado';
  END IF;

  -- 2. Validar se o item está aberto
  IF v_situacao <> 'aberto' THEN
    RAISE EXCEPTION 'fora_janela';
  END IF;

  -- 3. Validar se a janela de tempo expirou
  IF v_fecha_em IS NOT NULL AND v_fecha_em < v_horario_voto THEN
    RAISE EXCEPTION 'fora_janela';
  END IF;

  -- 4. Validar habilitação da unidade
  SELECT apta INTO v_apta
  FROM public.assembleia_habilitacoes
  WHERE assembleia_id = v_assembleia_id AND unidade_id = p_unidade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sem_habilitacao';
  END IF;

  IF NOT v_apta THEN
    RAISE EXCEPTION 'inadimplente';
  END IF;

  -- 5. Registro de Voto
  BEGIN
    IF v_secreto THEN
      -- Registro de controle (quem votou)
      INSERT INTO public.assembleia_votos_controle (
        item_id, 
        unidade_id, 
        created_at,
        ip,
        user_agent,
        device_hash
      ) VALUES (
        p_item_id,
        p_unidade_id,
        v_horario_voto,
        p_ip,
        p_user_agent,
        p_device_hash
      );

      -- Voto secreto (sem unidade_id, horário truncado pelo trigger ou manualmente aqui para reforçar)
      -- O trigger assembleia_votos_before_insert já cuida do truncamento e hash
      INSERT INTO public.assembleia_votos (
        item_id,
        opcao_id,
        unidade_id,
        peso,
        base_calculo,
        origem,
        ip,
        user_agent,
        device_hash,
        lancado_por,
        justificativa,
        created_at
      ) VALUES (
        p_item_id,
        p_opcao_id,
        NULL, -- unidade_id nulo para voto secreto
        p_peso,
        p_base_calculo,
        p_origem,
        p_ip,
        p_user_agent,
        p_device_hash,
        p_lancado_por,
        p_justificativa,
        v_horario_voto
      ) RETURNING id INTO v_recibo;

    ELSE
      -- Voto aberto
      INSERT INTO public.assembleia_votos (
        item_id,
        opcao_id,
        unidade_id,
        peso,
        base_calculo,
        origem,
        ip,
        user_agent,
        device_hash,
        lancado_por,
        justificativa,
        created_at
      ) VALUES (
        p_item_id,
        p_opcao_id,
        p_unidade_id,
        p_peso,
        p_base_calculo,
        p_origem,
        p_ip,
        p_user_agent,
        p_device_hash,
        p_lancado_por,
        p_justificativa,
        v_horario_voto
      ) RETURNING id INTO v_recibo;
    END IF;

  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ja_votou';
  END;

  RETURN v_recibo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assembleia_registrar_voto(uuid, uuid, uuid, numeric, text, text, inet, text, text, uuid, text) TO authenticated, service_role;
