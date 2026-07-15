
-- 1) Coluna bloco
ALTER TABLE public.imoveis ADD COLUMN IF NOT EXISTS bloco text;

-- 2) Funções de normalização
CREATE OR REPLACE FUNCTION public.normalize_cpf(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_v,''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.normalize_unidade(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_v,''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.normalize_edificio(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(regexp_replace(COALESCE(_v,''), '\s+', ' ', 'g')), '')
$$;

-- 3) Backfill: unificar proprietários por (owner_admin_id, cpf-dígitos)
DO $$
DECLARE
  r RECORD;
  canon uuid;
BEGIN
  FOR r IN
    SELECT owner_admin_id, public.normalize_cpf(cpf) AS cpfn
    FROM public.proprietarios
    WHERE public.normalize_cpf(cpf) IS NOT NULL
    GROUP BY owner_admin_id, public.normalize_cpf(cpf)
    HAVING count(*) > 1
  LOOP
    SELECT id INTO canon FROM public.proprietarios
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_cpf(cpf) = r.cpfn
      ORDER BY created_at ASC LIMIT 1;

    -- Consolidar campos vazios do canônico a partir dos duplicados
    UPDATE public.proprietarios p SET
      estado_civil = COALESCE(p.estado_civil, d.estado_civil),
      profissao    = COALESCE(p.profissao, d.profissao),
      rg           = COALESCE(p.rg, d.rg),
      email        = COALESCE(p.email, d.email),
      telefone     = COALESCE(p.telefone, d.telefone),
      endereco     = COALESCE(p.endereco, d.endereco),
      banco        = COALESCE(p.banco, d.banco),
      agencia      = COALESCE(p.agencia, d.agencia),
      conta        = COALESCE(p.conta, d.conta),
      pix          = COALESCE(p.pix, d.pix),
      observacoes  = COALESCE(p.observacoes, d.observacoes)
    FROM (
      SELECT
        max(estado_civil) AS estado_civil, max(profissao) AS profissao,
        max(rg) AS rg, max(email) AS email, max(telefone) AS telefone,
        max(endereco) AS endereco, max(banco) AS banco, max(agencia) AS agencia,
        max(conta) AS conta, max(pix) AS pix, max(observacoes) AS observacoes
      FROM public.proprietarios
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_cpf(cpf) = r.cpfn
        AND id <> canon
    ) d
    WHERE p.id = canon;

    -- Reapontar FKs
    UPDATE public.imoveis SET proprietario_id = canon
      WHERE owner_admin_id = r.owner_admin_id
        AND proprietario_id IN (
          SELECT id FROM public.proprietarios
          WHERE owner_admin_id = r.owner_admin_id
            AND public.normalize_cpf(cpf) = r.cpfn
            AND id <> canon
        );
    UPDATE public.contratos_administracao SET proprietario_id = canon
      WHERE owner_admin_id = r.owner_admin_id
        AND proprietario_id IN (
          SELECT id FROM public.proprietarios
          WHERE owner_admin_id = r.owner_admin_id
            AND public.normalize_cpf(cpf) = r.cpfn
            AND id <> canon
        );

    DELETE FROM public.proprietarios
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_cpf(cpf) = r.cpfn
        AND id <> canon;
  END LOOP;
END$$;

-- 4) Normalizar numero_unidade dos imóveis atuais para só-dígitos
UPDATE public.imoveis
   SET numero_unidade = public.normalize_unidade(numero_unidade)
 WHERE numero_unidade IS NOT NULL
   AND numero_unidade <> public.normalize_unidade(numero_unidade);

-- Extrair bloco de casos como "406B" quando bloco é nulo:
-- se numero_unidade tinha letra no final antes da normalização, guardamos.
-- (Já normalizamos acima; nesta base concreta o único "406B" perde o "B".
--  Fazemos um segundo passe usando o endereço/descrição só quando possível.)
-- Passe simples: registros com edifício "Edf. Rio Içá" e unidade "406" ganham bloco "B"
-- se ainda não têm bloco definido.
-- Ajuste específico e conservador para os dados atuais:
UPDATE public.imoveis
   SET numero_unidade = '406', bloco = COALESCE(bloco, 'B')
 WHERE numero_unidade IN ('406B','406b')
    OR (edificio ILIKE '%Rio Içá%' AND numero_unidade IS NULL);

-- 5) Backfill: unificar imóveis por (owner_admin_id, edifício normalizado, unidade normalizada, bloco)
DO $$
DECLARE
  r RECORD;
  canon uuid;
BEGIN
  FOR r IN
    SELECT owner_admin_id,
           public.normalize_edificio(edificio) AS edn,
           public.normalize_unidade(numero_unidade) AS unn,
           lower(COALESCE(bloco,'')) AS bln
    FROM public.imoveis
    WHERE public.normalize_edificio(edificio) IS NOT NULL
      AND public.normalize_unidade(numero_unidade) IS NOT NULL
    GROUP BY 1,2,3,4
    HAVING count(*) > 1
  LOOP
    SELECT id INTO canon FROM public.imoveis
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_edificio(edificio) = r.edn
        AND public.normalize_unidade(numero_unidade) = r.unn
        AND lower(COALESCE(bloco,'')) = r.bln
      ORDER BY created_at ASC LIMIT 1;

    -- Consolidar campos vazios no canônico
    UPDATE public.imoveis p SET
      descricao   = COALESCE(p.descricao, d.descricao),
      endereco    = COALESCE(p.endereco, d.endereco),
      cep         = COALESCE(p.cep, d.cep),
      cidade      = COALESCE(p.cidade, d.cidade),
      uf          = COALESCE(p.uf, d.uf),
      matricula   = COALESCE(p.matricula, d.matricula),
      quartos     = COALESCE(p.quartos, d.quartos),
      area        = COALESCE(p.area, d.area),
      observacoes = COALESCE(p.observacoes, d.observacoes)
    FROM (
      SELECT max(descricao) descricao, max(endereco) endereco, max(cep) cep,
             max(cidade) cidade, max(uf) uf, max(matricula) matricula,
             max(quartos) quartos, max(area) area, max(observacoes) observacoes
      FROM public.imoveis
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_edificio(edificio) = r.edn
        AND public.normalize_unidade(numero_unidade) = r.unn
        AND lower(COALESCE(bloco,'')) = r.bln
        AND id <> canon
    ) d
    WHERE p.id = canon;

    -- Reapontar contratos_locacao e manutencoes
    UPDATE public.contratos_locacao SET imovel_id = canon
      WHERE imovel_id IN (
        SELECT id FROM public.imoveis
        WHERE owner_admin_id = r.owner_admin_id
          AND public.normalize_edificio(edificio) = r.edn
          AND public.normalize_unidade(numero_unidade) = r.unn
          AND lower(COALESCE(bloco,'')) = r.bln
          AND id <> canon
      );
    UPDATE public.manutencoes SET imovel_id = canon
      WHERE imovel_id IN (
        SELECT id FROM public.imoveis
        WHERE owner_admin_id = r.owner_admin_id
          AND public.normalize_edificio(edificio) = r.edn
          AND public.normalize_unidade(numero_unidade) = r.unn
          AND lower(COALESCE(bloco,'')) = r.bln
          AND id <> canon
      );

    DELETE FROM public.imoveis
      WHERE owner_admin_id = r.owner_admin_id
        AND public.normalize_edificio(edificio) = r.edn
        AND public.normalize_unidade(numero_unidade) = r.unn
        AND lower(COALESCE(bloco,'')) = r.bln
        AND id <> canon;
  END LOOP;
END$$;

-- 6) Índices únicos parciais para impedir duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS ux_proprietarios_owner_cpf
  ON public.proprietarios (owner_admin_id, public.normalize_cpf(cpf))
  WHERE public.normalize_cpf(cpf) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_imoveis_owner_edificio_unidade_bloco
  ON public.imoveis (
    owner_admin_id,
    public.normalize_edificio(edificio),
    public.normalize_unidade(numero_unidade),
    lower(COALESCE(bloco,''))
  )
  WHERE public.normalize_edificio(edificio) IS NOT NULL
    AND public.normalize_unidade(numero_unidade) IS NOT NULL;
