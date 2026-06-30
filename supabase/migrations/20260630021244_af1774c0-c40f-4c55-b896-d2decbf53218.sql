
-- Enum tipo unidade
DO $$ BEGIN
  CREATE TYPE public.tipo_unidade AS ENUM ('apartamento','casa','sala_comercial','loja','vaga_avulsa','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_condomino AS ENUM ('proprietario','inquilino','morador','responsavel_legal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unidades
CREATE TABLE IF NOT EXISTS public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  bloco text,
  numero text NOT NULL,
  tipo public.tipo_unidade NOT NULL DEFAULT 'apartamento',
  fracao_ideal numeric(10,6),
  area_m2 numeric(10,2),
  vagas_garagem int DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condominio_id, bloco, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver unidades"
  ON public.unidades FOR SELECT TO authenticated
  USING (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Donos podem inserir unidades"
  ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE POLICY "Donos podem atualizar unidades"
  ON public.unidades FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE POLICY "Donos podem deletar unidades"
  ON public.unidades FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_unidades_condominio ON public.unidades(condominio_id);

CREATE TRIGGER tg_unidades_updated_at
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Condôminos
CREATE TABLE IF NOT EXISTS public.condominos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,
  tipo public.tipo_condomino NOT NULL DEFAULT 'proprietario',
  principal boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominos TO authenticated;
GRANT ALL ON public.condominos TO service_role;

ALTER TABLE public.condominos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver condominos"
  ON public.condominos FOR SELECT TO authenticated
  USING (public.is_condominio_member(condominio_id, auth.uid()));

CREATE POLICY "Donos podem inserir condominos"
  ON public.condominos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE POLICY "Donos podem atualizar condominos"
  ON public.condominos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE POLICY "Donos podem deletar condominos"
  ON public.condominos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_condominos_unidade ON public.condominos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_condominos_condominio ON public.condominos(condominio_id);

CREATE TRIGGER tg_condominos_updated_at
  BEFORE UPDATE ON public.condominos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
