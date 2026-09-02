-- Migracao: Cadastro exclusivo dos 79 condominios para marcelo@versari.com.br com compartilhamento de equipe
-- Regra de seguranca: Condominios ja existentes nao sao alterados nem substituidos, apenas ignorados.

DO $$
DECLARE
  v_marcelo_id uuid;
  v_member record;
  v_condo record;
BEGIN
  -- 1. Localizar ou obter o ID de Marcelo Versari
  SELECT id INTO v_marcelo_id FROM auth.users WHERE LOWER(email) = 'marcelo@versari.com.br' LIMIT 1;

  IF v_marcelo_id IS NULL THEN
    SELECT id INTO v_marcelo_id FROM public.profiles WHERE LOWER(email) = 'marcelo@versari.com.br' LIMIT 1;
  END IF;

  -- Se nao existir na auth.users ainda, provisiona registro base deterministico
  IF v_marcelo_id IS NULL THEN
    v_marcelo_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_marcelo_id,
      'marcelo@versari.com.br',
      crypt('Versari@2026!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('nome', 'Marcelo Versari'),
      now(),
      now(),
      'authenticated',
      'authenticated'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Provisiona / garante perfil ativo para Marcelo
  INSERT INTO public.profiles (
    id,
    nome,
    email,
    perfil_atuacao,
    onboarding_completo,
    onboarding_tour_completo,
    dicas_ativas
  ) VALUES (
    v_marcelo_id,
    'Marcelo Versari',
    'marcelo@versari.com.br',
    'administradora',
    true,
    true,
    false
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;

  -- Garante plano Administradora (multiusuario e sem limites de condominios)
  INSERT INTO public.subscriptions (
    user_id,
    plano_config_id,
    status,
    cortesia
  ) VALUES (
    v_marcelo_id,
    'administradora',
    'active',
    true
  ) ON CONFLICT (user_id) DO UPDATE SET
    plano_config_id = 'administradora',
    status = 'active',
    cortesia = true;

  -- 2. Tabela temporaria com os 79 condominios da planilha
  CREATE TEMP TABLE temp_seed_condominios (
    nome text,
    cnpj text,
    categoria text,
    uf text,
    cidade text
  ) ON COMMIT DROP;

  INSERT INTO temp_seed_condominios (nome, cnpj, categoria, uf, cidade) VALUES
    ('ACQUA OCEANIA', '51.708.200/0001-34', 'predio', 'PB', 'JOÃO PESSOA'),
    ('ALFAMARES', '41.140.336/0001-37', 'predio', 'PB', 'CABEDELO'),
    ('ALLIANCE HOUSE', '49.963.600/0001-44', 'casas', 'PB', 'CABEDELO'),
    ('ALLIANCE PLAZA COMERCIAL', '27.092.497/0002-52', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('ALLIANCE PLAZA EMPRESARIAL', '27.092.497/0003-33', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('ALLIANCE PLAZA HOME', '27.092.497/0001-71', 'predio', 'PB', 'JOÃO PESSOA'),
    ('ALTAVISTA', '22.665.743/0001-13', 'predio', 'PB', 'JOÃO PESSOA'),
    ('ALTIPLEX MALL', '31.191.112/0004-43', 'shopping', 'PB', 'JOÃO PESSOA'),
    ('ALTIPLEX OFFICE', '31.191.112/0003-62', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('BAÍA DE NÁPOLES', '15.574.003/0001-06', 'predio', 'PB', 'JOÃO PESSOA'),
    ('BARON DE MONTESQUIEU', '20.512.179/0001-73', 'predio', 'PB', 'JOÃO PESSOA'),
    ('BELVEDERE', '68.366.231/0001-57', 'predio', 'PB', 'CABEDELO'),
    ('BLUE TOWER', '06.025.487/0001-43', 'predio', 'PB', 'JOÃO PESSOA'),
    ('BOSQUE DAS GAMELEIRAS', '11.103.675/0001-82', 'casas', 'PB', 'JOÃO PESSOA'),
    ('CORAIS DO ATLÂNTICO', '60.791.133/0001-55', 'predio', 'PB', 'CABEDELO'),
    ('CORALES BOUTIQUE RESIDENCE', '62.611.577/0001-97', 'predio', 'PB', 'CABEDELO'),
    ('COSTA BELLA', '22.157.306/0001-99', 'predio', 'PB', 'CONDE'),
    ('D''OURO TAMBAÚ', '27.289.241/0001-59', 'predio', 'PB', 'JOÃO PESSOA'),
    ('EMUNAH DE CITTÀ', '60.670.698/0001-84', 'predio', 'PB', 'CABEDELO'),
    ('FALÉSIA', '62.691.743/0001-02', 'predio', 'PB', 'JOÃO PESSOA'),
    ('FLORENÇA', '12.801.082/0001-52', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GAMELEIRA JARDINS', '59.854.506/0001-00', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GAMELEIRA PRAIA', '59.953.037/0001-87', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GARDEN HAUS', '63.176.134/0001-88', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GAUDIUM FLAT', '52.278.922/0001-69', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GLENN MILLER', '03.202.307/0001-63', 'predio', 'PB', 'JOÃO PESSOA'),
    ('GRANDMARE', '22.035.002/0001-59', 'predio', 'PB', 'JOÃO PESSOA'),
    ('HIT CABO BRANCO', '63.618.883/0001-18', 'predio', 'PB', 'JOÃO PESSOA'),
    ('HORIZON (GERAL)', '66.766.126/0001-80', 'predio', 'PB', 'JOÃO PESSOA'),
    ('HORIZON (HOME)', '66.766.126/0002-60', 'predio', 'PB', 'JOÃO PESSOA'),
    ('HORIZON (MALL)', '66.766.126/0003-41', 'shopping', 'PB', 'JOÃO PESSOA'),
    ('HORTUS (MATRIZ)', '67.507.736/0001-21', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('HP SHOPPING', '26.013.313/0001-78', 'shopping', 'PB', 'JOÃO PESSOA'),
    ('JANGADA', '68.846.608/0001-75', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('JOÃO RODRIGUES', '57.915.177/0001-35', 'predio', 'PB', 'JOÃO PESSOA'),
    ('KOA NICE LIVING', '58.472.693/0001-03', 'predio', 'PB', 'JOÃO PESSOA'),
    ('LA MAR', '44.180.389/0001-70', 'predio', 'PB', 'CABEDELO'),
    ('LAGRANGE', '49.673.125/0001-71', 'predio', 'PB', 'JOÃO PESSOA'),
    ('LE LABO BOUTIQUE OFFICES', '59.576.566/0001-09', 'salas_comerciais', 'PB', 'JOÃO PESSOA'),
    ('LUNA PLAZA', '24.702.511/0001-13', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MAISON MIRAMAR', '23.169.883/0001-63', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MAISON MOLIÈRE', '10.454.068/0001-02', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MANAÍRA PARQUE', '30.863.386/0001-26', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MIRAMAR PARK', '33.568.151/0001-08', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MONTE ARAGATS', '19.691.867/0001-69', 'predio', 'PB', 'JOÃO PESSOA'),
    ('MONTE SINAI', '47.903.559/0001-95', 'predio', 'PB', 'BANANEIRAS'),
    ('MORADA DAS FALÉSIAS', '25.377.394/0001-22', 'predio', 'PB', 'PITIMBU'),
    ('MORIAH HOME SERVICE', '23.621.338/0001-66', 'predio', 'PB', 'JOÃO PESSOA'),
    ('NOA', '64.062.057/0001-06', 'predio', 'PB', 'CABEDELO'),
    ('OLGA AMORIM', '51.771.295/0001-30', 'predio', 'PB', 'JOÃO PESSOA'),
    ('ONCOVIDA', '11.471.525/0001-21', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PALAZZO DI TOSCANA', '29.945.277/0001-79', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PALAZZO ESSENZIALE', '22.466.847/0001-07', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PARAÍSO DO ATLÂNTICO', '22.014.097/0001-24', 'predio', 'PB', 'CABEDELO'),
    ('PARK DEL PRADO', '46.514.219/0001-00', 'predio', 'PB', 'CABEDELO'),
    ('PARK GUELL', '30.114.520/0001-96', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PARUS RESIDENCE', '62.084.081/0001-02', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PENT HAUS BESSA', '67.022.307/0001-64', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PORTO ATLÂNTICO', '51.940.243/0001-40', 'predio', 'PB', 'CABEDELO'),
    ('PORTO REAL', '19.544.719/0001-11', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PRIME VIEW', '63.046.374/0001-68', 'predio', 'PB', 'JOÃO PESSOA'),
    ('PRÍNCIPE DE VENEZA', '07.868.262/0001-11', 'predio', 'PB', 'JOÃO PESSOA'),
    ('RESERVA DO ATLÂNTICO', '35.066.908/0001-82', 'predio', 'PB', 'CABEDELO'),
    ('ROYAL OCEANIA', '42.158.419/0001-16', 'predio', 'PB', 'JOÃO PESSOA'),
    ('SELETTO LIFE STYLE', '40.167.407/0001-22', 'predio', 'PB', 'JOÃO PESSOA'),
    ('SETAI CASAS VERTICAIS', '51.273.384/0001-57', 'predio', 'PB', 'JOÃO PESSOA'),
    ('SOLAR PORTOFINO', '43.124.315/0001-53', 'predio', 'PB', 'CABEDELO'),
    ('SOLAR TAMBAÚ', '29.643.607/0001-71', 'predio', 'PB', 'JOÃO PESSOA'),
    ('STUDIO MANAÍRA FLAT', '01.503.928/0001-51', 'predio', 'PB', 'JOÃO PESSOA'),
    ('TARSILA DO AMARAL', '43.737.440/0001-39', 'predio', 'PB', 'JOÃO PESSOA'),
    ('THE HAUS', '55.400.694/0001-46', 'predio', 'PB', 'JOÃO PESSOA'),
    ('TOURS MONT BLANC', '19.843.418/0001-99', 'predio', 'PB', 'JOÃO PESSOA'),
    ('URBAN BLUE VIEW', '64.190.690/0001-71', 'predio', 'PB', 'CABEDELO'),
    ('URBAN MARES', '63.614.202/0001-43', 'predio', 'PB', 'CABEDELO'),
    ('VIENNA', '10.466.339/0001-31', 'predio', 'PB', 'JOÃO PESSOA'),
    ('VIVERE HOME RESORT', '64.894.886/0001-47', 'predio', 'PB', 'CABEDELO'),
    ('VOLL29 STUDIO', '58.265.033/0001-43', 'predio', 'PB', 'JOÃO PESSOA'),
    ('WELLINGTON BARRETO', '40.167.663/0001-10', 'predio', 'PB', 'JOÃO PESSOA'),
    ('ZULMA COMFY HOME', '66.883.672/0001-09', 'predio', 'PB', 'JOÃO PESSOA');

  -- 3. Insercao segura e idempotente: IGNORA qualquer condominio que ja existir
  INSERT INTO public.condominios (
    owner_id,
    nome,
    cnpj,
    categoria,
    uf,
    cidade,
    created_at,
    updated_at
  )
  SELECT
    v_marcelo_id,
    t.nome,
    t.cnpj,
    t.categoria,
    t.uf,
    t.cidade,
    now(),
    now()
  FROM temp_seed_condominios t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.condominios c
    WHERE c.owner_id = v_marcelo_id
      AND (
        LOWER(TRIM(c.nome)) = LOWER(TRIM(t.nome))
        OR (
          c.cnpj IS NOT NULL AND t.cnpj IS NOT NULL
          AND regexp_replace(c.cnpj, '\D', '', 'g') = regexp_replace(t.cnpj, '\D', '', 'g')
        )
      )
  );

  -- 4. Compartilhar com todos os membros vinculados a equipe de Marcelo
  FOR v_member IN (
    SELECT DISTINCT user_id
    FROM public.condominio_members
    WHERE criado_por = v_marcelo_id
      AND user_id <> v_marcelo_id
  ) LOOP
    FOR v_condo IN (
      SELECT id FROM public.condominios WHERE owner_id = v_marcelo_id
    ) LOOP
      INSERT INTO public.condominio_members (
        condominio_id,
        user_id,
        criado_por,
        papel,
        pode_gerenciar_contratos,
        pode_gerenciar_documentos,
        pode_gerenciar_assembleias,
        pode_gerenciar_unidades,
        pode_gerenciar_usuarios,
        created_at,
        updated_at
      ) VALUES (
        v_condo.id,
        v_member.user_id,
        v_marcelo_id,
        'sindico'::public.papel_condo_v2,
        true,
        true,
        true,
        true,
        true,
        now(),
        now()
      ) ON CONFLICT (condominio_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;

END $$;

-- 5. Trigger para sincronizacao automatica: novos membros da equipe recebem acesso imediato a todos os condominios
CREATE OR REPLACE FUNCTION public.fn_auto_link_team_member_to_condominios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.criado_por IS NOT NULL AND NEW.criado_por <> NEW.user_id THEN
    INSERT INTO public.condominio_members (
      condominio_id,
      user_id,
      criado_por,
      papel,
      pode_gerenciar_contratos,
      pode_gerenciar_documentos,
      pode_gerenciar_assembleias,
      pode_gerenciar_unidades,
      pode_gerenciar_usuarios,
      created_at,
      updated_at
    )
    SELECT
      c.id,
      NEW.user_id,
      NEW.criado_por,
      COALESCE(NEW.papel, 'sindico'::public.papel_condo_v2),
      NEW.pode_gerenciar_contratos,
      NEW.pode_gerenciar_documentos,
      NEW.pode_gerenciar_assembleias,
      NEW.pode_gerenciar_unidades,
      NEW.pode_gerenciar_usuarios,
      now(),
      now()
    FROM public.condominios c
    WHERE c.owner_id = NEW.criado_por
      AND c.id <> NEW.condominio_id
    ON CONFLICT (condominio_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_team_member_condos ON public.condominio_members;
CREATE TRIGGER trg_auto_link_team_member_condos
AFTER INSERT ON public.condominio_members
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_link_team_member_to_condominios();
