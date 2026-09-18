-- =====================================================================
-- Arquitetura "Registro > Linha": recorte auditável + ledger de leitura
-- =====================================================================

-- 1) O RECORTE. Cada registro é UMA unidade, delimitada por POSIÇÃO no documento.
CREATE TABLE IF NOT EXISTS public.documento_registros (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  documento_id  UUID NOT NULL REFERENCES public.documentos(id)  ON DELETE CASCADE,
  registro_id   TEXT NOT NULL,   -- documento_id:pagina:offset_inicio (posicional, nunca deduplicado)
  pagina        INTEGER,
  offset_inicio INTEGER,
  offset_fim    INTEGER,
  escopo        TEXT,            -- BLOCO A / QUADRA 03 / TORRE 1 — herdado do cabeçalho vigente
  numero        TEXT NOT NULL,
  sufixo        TEXT,            -- a letra de "101-A", quando houver
  ancora        TEXT,            -- o texto exato que identificou a unidade
  padrao_ancora TEXT,            -- qual reconhecedor disparou (auditoria)
  texto         TEXT NOT NULL,   -- o registro íntegro: da âncora até a próxima âncora
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documento_registros_unico UNIQUE (documento_id, registro_id)
);

-- NÃO crie UNIQUE por (documento_id, escopo, numero). É deliberado: a mesma identidade
-- pode aparecer duas vezes no documento e isso precisa ser gravado e mostrado na
-- conciliação, nunca silenciado por uma constraint.
CREATE INDEX IF NOT EXISTS documento_registros_doc_idx
  ON public.documento_registros (documento_id, pagina, offset_inicio);
CREATE INDEX IF NOT EXISTS documento_registros_identidade_idx
  ON public.documento_registros (documento_id, escopo, numero);

-- 2) O LEDGER. Toda unidade termina aqui — inclusive as que não foram lidas.
CREATE TABLE IF NOT EXISTS public.extracao_ledger (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id      UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  documento_id       UUID NOT NULL REFERENCES public.documentos(id)  ON DELETE CASCADE,
  registro_id        TEXT,          -- NULL quando a unidade consta do rol e nenhum registro foi achado
  escopo             TEXT,
  numero             TEXT NOT NULL,
  estado             TEXT NOT NULL CHECK (estado IN ('lido','lido_com_ressalva','nao_lido')),
  origem             TEXT NOT NULL DEFAULT 'rotulo'
                     CHECK (origem IN ('rotulo','ia','manual','ausente')),
  motivos            JSONB NOT NULL DEFAULT '[]'::jsonb,
  medidas            JSONB NOT NULL DEFAULT '[]'::jsonb,
  medidas_rejeitadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  trecho_fonte       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Também sem UNIQUE por identidade, pelo mesmo motivo. Cada nova leitura APAGA por
-- documento_id e insere tudo de novo (o mesmo padrão já usado em sugestoes_unidades):
-- não use upsert.
CREATE INDEX IF NOT EXISTS extracao_ledger_doc_estado_idx
  ON public.extracao_ledger (documento_id, estado);
CREATE INDEX IF NOT EXISTS extracao_ledger_cond_idx
  ON public.extracao_ledger (condominio_id, created_at DESC);

-- 3) Permissões e RLS — idênticas ao padrão de sugestoes_unidades.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_registros TO authenticated;
GRANT ALL ON public.documento_registros TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracao_ledger     TO authenticated;
GRANT ALL ON public.extracao_ledger     TO service_role;

ALTER TABLE public.documento_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracao_ledger     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documento_registros' AND policyname = 'Membro le registros'
  ) THEN
    CREATE POLICY "Membro le registros"
      ON public.documento_registros FOR SELECT TO authenticated
      USING (
        public.is_condominio_member(condominio_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documento_registros' AND policyname = 'Membro insere registros'
  ) THEN
    CREATE POLICY "Membro insere registros"
      ON public.documento_registros FOR INSERT TO authenticated
      WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documento_registros' AND policyname = 'Membro atualiza registros'
  ) THEN
    CREATE POLICY "Membro atualiza registros"
      ON public.documento_registros FOR UPDATE TO authenticated
      USING (public.is_condominio_member(condominio_id, auth.uid()))
      WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documento_registros' AND policyname = 'Membro apaga registros'
  ) THEN
    CREATE POLICY "Membro apaga registros"
      ON public.documento_registros FOR DELETE TO authenticated
      USING (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extracao_ledger' AND policyname = 'Membro le ledger'
  ) THEN
    CREATE POLICY "Membro le ledger"
      ON public.extracao_ledger FOR SELECT TO authenticated
      USING (
        public.is_condominio_member(condominio_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extracao_ledger' AND policyname = 'Membro insere ledger'
  ) THEN
    CREATE POLICY "Membro insere ledger"
      ON public.extracao_ledger FOR INSERT TO authenticated
      WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extracao_ledger' AND policyname = 'Membro atualiza ledger'
  ) THEN
    CREATE POLICY "Membro atualiza ledger"
      ON public.extracao_ledger FOR UPDATE TO authenticated
      USING (public.is_condominio_member(condominio_id, auth.uid()))
      WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extracao_ledger' AND policyname = 'Membro apaga ledger'
  ) THEN
    CREATE POLICY "Membro apaga ledger"
      ON public.extracao_ledger FOR DELETE TO authenticated
      USING (public.is_condominio_member(condominio_id, auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS extracao_ledger_set_updated_at ON public.extracao_ledger;
CREATE TRIGGER extracao_ledger_set_updated_at
  BEFORE UPDATE ON public.extracao_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();