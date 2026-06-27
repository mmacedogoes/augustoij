
-- ============================================================
-- BLOCO 1 — REFATORAÇÃO ESTRUTURAL DO SCHEMA condoIA (v2)
-- ============================================================

-- 1. Enums novos -------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.papel_sistema AS ENUM (
    'super_admin','admin_operacional','admin_suporte',
    'cliente_pf','cliente_pj_dono','cliente_pj_operador'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_pessoa AS ENUM ('pf','pj');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.papel_condo_v2 AS ENUM ('dono_condominio','operador_condominio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.blog_status AS ENUM ('rascunho','publicado','agendado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. profiles ---------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS papel_sistema       public.papel_sistema,
  ADD COLUMN IF NOT EXISTS tipo_pessoa         public.tipo_pessoa,
  ADD COLUMN IF NOT EXISTS cpf_cnpj            text,
  ADD COLUMN IF NOT EXISTS razao_social        text,
  ADD COLUMN IF NOT EXISTS convidado_por       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_acesso       timestamptz;

UPDATE public.profiles p
SET papel_sistema = 'super_admin'
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
  AND papel_sistema IS NULL;

UPDATE public.profiles
SET papel_sistema = 'cliente_pf', tipo_pessoa = COALESCE(tipo_pessoa,'pf')
WHERE papel_sistema IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN papel_sistema SET NOT NULL,
  ALTER COLUMN papel_sistema SET DEFAULT 'cliente_pf';

ALTER TABLE public.profiles ALTER COLUMN oab DROP NOT NULL;

-- 3. Funções helper PRIMEIRO (policies dependem) ----------------
CREATE OR REPLACE FUNCTION public.has_papel_sistema(_user_id uuid, _papeis public.papel_sistema[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND papel_sistema = ANY(_papeis)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_papel_sistema(_user_id, ARRAY['super_admin']::public.papel_sistema[]) $$;

CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_papel_sistema(_user_id, ARRAY['super_admin','admin_operacional','admin_suporte']::public.papel_sistema[]) $$;

-- has_role compatível (RPCs antigos chamam has_role(uid,'admin'::app_role))
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN _role = 'admin'::app_role THEN public.is_any_admin(_user_id) ELSE false END
$$;

-- 4. condominio_members --------------------------------------
ALTER TABLE public.condominio_members ADD COLUMN IF NOT EXISTS papel public.papel_condo_v2;

UPDATE public.condominio_members
SET papel = 'dono_condominio'
WHERE papel IS NULL
  AND EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_members.condominio_id AND c.owner_id = condominio_members.user_id);

UPDATE public.condominio_members
SET papel = 'operador_condominio'
WHERE papel IS NULL;

ALTER TABLE public.condominio_members
  ALTER COLUMN papel SET NOT NULL,
  ALTER COLUMN papel SET DEFAULT 'operador_condominio';

-- 5. Planos ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planos (
  id                     text PRIMARY KEY,
  nome                   text NOT NULL,
  tipo_pessoa            public.tipo_pessoa NOT NULL,
  preco_mensal           numeric(10,2),
  limite_condominios     int,
  limite_usuarios        int,
  limite_mensagens_mes   int,
  limite_storage_mb      int,
  descricao              text,
  features               text[] NOT NULL DEFAULT '{}',
  ativo                  boolean NOT NULL DEFAULT true,
  ordem                  int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planos TO anon, authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planos_select_all ON public.planos;
CREATE POLICY planos_select_all ON public.planos FOR SELECT USING (true);
DROP POLICY IF EXISTS planos_admin_all ON public.planos;
CREATE POLICY planos_admin_all ON public.planos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS set_planos_updated_at ON public.planos;
CREATE TRIGGER set_planos_updated_at BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Créditos avulsos -----------------------------------------
CREATE TABLE IF NOT EXISTS public.creditos_avulsos (
  id                   text PRIMARY KEY,
  nome                 text NOT NULL,
  quantidade_mensagens int NOT NULL,
  preco                numeric(10,2) NOT NULL,
  ativo                boolean NOT NULL DEFAULT true,
  ordem                int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creditos_avulsos TO anon, authenticated;
GRANT ALL ON public.creditos_avulsos TO service_role;
ALTER TABLE public.creditos_avulsos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creditos_select_all ON public.creditos_avulsos;
CREATE POLICY creditos_select_all ON public.creditos_avulsos FOR SELECT USING (true);
DROP POLICY IF EXISTS creditos_admin_all ON public.creditos_avulsos;
CREATE POLICY creditos_admin_all ON public.creditos_avulsos FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 7. subscriptions ---------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plano_id                  text REFERENCES public.planos(id),
  ADD COLUMN IF NOT EXISTS creditos_mensagens_extras int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_assinatura           text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS trial_end                 timestamptz;

ALTER TABLE public.subscriptions ALTER COLUMN trial_end SET DEFAULT (now() + interval '3 days');
ALTER TABLE public.subscriptions ALTER COLUMN plano DROP NOT NULL;

DROP POLICY IF EXISTS subscriptions_super_admin_all ON public.subscriptions;
CREATE POLICY subscriptions_super_admin_all ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
CREATE POLICY subscriptions_update_own ON public.subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8. Financeiro ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.despesas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao     text NOT NULL,
  categoria     text NOT NULL,
  valor         numeric(12,2) NOT NULL,
  data          date NOT NULL DEFAULT current_date,
  recorrente    boolean NOT NULL DEFAULT false,
  periodicidade text NOT NULL DEFAULT 'unica',
  automatica    boolean NOT NULL DEFAULT false,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS despesas_super_admin ON public.despesas;
CREATE POLICY despesas_super_admin ON public.despesas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS set_despesas_updated_at ON public.despesas;
CREATE TRIGGER set_despesas_updated_at BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.custos_cliente_mensal (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano               date NOT NULL,
  custo_tokens_openai   numeric(12,4) NOT NULL DEFAULT 0,
  custo_embeddings      numeric(12,4) NOT NULL DEFAULT 0,
  custo_storage         numeric(12,4) NOT NULL DEFAULT 0,
  total_mensagens       int NOT NULL DEFAULT 0,
  total_tokens_input    int NOT NULL DEFAULT 0,
  total_tokens_output   int NOT NULL DEFAULT 0,
  margem_estimada       numeric(12,4) NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes_ano)
);
GRANT SELECT ON public.custos_cliente_mensal TO authenticated;
GRANT ALL ON public.custos_cliente_mensal TO service_role;
ALTER TABLE public.custos_cliente_mensal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custos_select ON public.custos_cliente_mensal;
CREATE POLICY custos_select ON public.custos_cliente_mensal FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());
DROP POLICY IF EXISTS custos_super_write ON public.custos_cliente_mensal;
CREATE POLICY custos_super_write ON public.custos_cliente_mensal FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 9. Blog ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  descricao  text,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_categorias TO anon, authenticated;
GRANT ALL ON public.blog_categorias TO service_role;
ALTER TABLE public.blog_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blog_cat_public_read ON public.blog_categorias;
CREATE POLICY blog_cat_public_read ON public.blog_categorias FOR SELECT USING (true);
DROP POLICY IF EXISTS blog_cat_admin_write ON public.blog_categorias;
CREATE POLICY blog_cat_admin_write ON public.blog_categorias FOR ALL TO authenticated
  USING (public.has_papel_sistema(auth.uid(), ARRAY['super_admin','admin_operacional']::public.papel_sistema[]))
  WITH CHECK (public.has_papel_sistema(auth.uid(), ARRAY['super_admin','admin_operacional']::public.papel_sistema[]));

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo           text NOT NULL,
  slug             text NOT NULL UNIQUE,
  resumo           text,
  conteudo_markdown text,
  imagem_capa      text,
  categoria_id     uuid REFERENCES public.blog_categorias(id) ON DELETE SET NULL,
  tags             text[] NOT NULL DEFAULT '{}',
  status           public.blog_status NOT NULL DEFAULT 'rascunho',
  publicado_em     timestamptz,
  agendado_para    timestamptz,
  autor_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta_description text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON public.blog_posts(status, publicado_em DESC);
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
CREATE POLICY blog_posts_public_read ON public.blog_posts FOR SELECT
  USING (status='publicado' AND publicado_em IS NOT NULL AND publicado_em <= now());
DROP POLICY IF EXISTS blog_posts_admin_read ON public.blog_posts;
CREATE POLICY blog_posts_admin_read ON public.blog_posts FOR SELECT TO authenticated
  USING (public.has_papel_sistema(auth.uid(), ARRAY['super_admin','admin_operacional']::public.papel_sistema[]));
DROP POLICY IF EXISTS blog_posts_admin_write ON public.blog_posts;
CREATE POLICY blog_posts_admin_write ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_papel_sistema(auth.uid(), ARRAY['super_admin','admin_operacional']::public.papel_sistema[]))
  WITH CHECK (public.has_papel_sistema(auth.uid(), ARRAY['super_admin','admin_operacional']::public.papel_sistema[]));
DROP TRIGGER IF EXISTS set_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER set_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 10. handle_new_user atualizado -----------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tipo public.tipo_pessoa := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_pessoa','')::public.tipo_pessoa, 'pf');
  _papel public.papel_sistema := CASE WHEN _tipo = 'pj' THEN 'cliente_pj_dono'::public.papel_sistema ELSE 'cliente_pf'::public.papel_sistema END;
BEGIN
  INSERT INTO public.profiles (id, nome, email, telefone, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, lgpd_aceite_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone',
    _tipo,
    NEW.raw_user_meta_data->>'cpf_cnpj',
    NEW.raw_user_meta_data->>'razao_social',
    _papel,
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_aceite')::boolean IS TRUE THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. calcular_custo_mensal ----------------------------------
CREATE OR REPLACE FUNCTION public.calcular_custo_mensal(_user_id uuid, _mes_ano date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _mes text := to_char(_mes_ano, 'YYYY-MM');
  _usd_brl numeric := 5.20;
  _in_rate numeric := 0.15 / 1000000;
  _out_rate numeric := 0.60 / 1000000;
  _msgs int; _tokens int; _custo_io numeric;
BEGIN
  IF NOT public.is_any_admin(auth.uid()) AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT COALESCE(total_mensagens,0), COALESCE(total_tokens,0) INTO _msgs, _tokens
    FROM public.uso_mensal WHERE user_id = _user_id AND mes_ano = _mes;
  _custo_io := COALESCE(_tokens,0) * ((_in_rate + _out_rate)/2) * _usd_brl;
  RETURN jsonb_build_object(
    'mes_ano', _mes, 'total_mensagens', COALESCE(_msgs,0), 'total_tokens', COALESCE(_tokens,0),
    'custo_tokens_brl', _custo_io, 'custo_embeddings_brl', 0, 'custo_storage_brl', 0, 'usd_brl', _usd_brl);
END;
$$;

-- 12. Policies de profiles/condominios/documentos -----------
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
CREATE POLICY profiles_admin_read ON public.profiles FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_super_admin_update ON public.profiles;
CREATE POLICY profiles_super_admin_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS condominios_update_dono ON public.condominios;
CREATE POLICY condominios_update_dono ON public.condominios FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.condominio_members m
      WHERE m.condominio_id = condominios.id AND m.user_id = auth.uid() AND m.papel='dono_condominio'
    )
  )
  WITH CHECK (
    owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.condominio_members m
      WHERE m.condominio_id = condominios.id AND m.user_id = auth.uid() AND m.papel='dono_condominio'
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='documentos') THEN
    EXECUTE 'DROP POLICY IF EXISTS documentos_write_dono ON public.documentos';
    EXECUTE 'CREATE POLICY documentos_write_dono ON public.documentos FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.condominio_members m
                WHERE m.condominio_id = documentos.condominio_id
                  AND m.user_id = auth.uid() AND m.papel = ''dono_condominio'')
        OR EXISTS (SELECT 1 FROM public.condominios c
                WHERE c.id = documentos.condominio_id AND c.owner_id = auth.uid())
      )';
    EXECUTE 'DROP POLICY IF EXISTS documentos_delete_dono ON public.documentos';
    EXECUTE 'CREATE POLICY documentos_delete_dono ON public.documentos FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.condominio_members m
                WHERE m.condominio_id = documentos.condominio_id
                  AND m.user_id = auth.uid() AND m.papel = ''dono_condominio'')
        OR EXISTS (SELECT 1 FROM public.condominios c
                WHERE c.id = documentos.condominio_id AND c.owner_id = auth.uid())
      )';
  END IF;
END $$;

-- 13. Seeds ---------------------------------------------------
INSERT INTO public.planos (id, nome, tipo_pessoa, preco_mensal, limite_condominios, limite_usuarios, limite_mensagens_mes, limite_storage_mb, descricao, features, ordem) VALUES
  ('pf_basico',     'PF Básico',     'pf', 97,   1,    1,    200,  100,  'Para síndicos profissionais autônomos.',
    ARRAY['1 condomínio','200 mensagens/mês','100 MB de documentos','Suporte por e-mail'], 1),
  ('pf_pro',        'PF Pro',        'pf', 247,  3,    1,    800,  300,  'Para síndicos com múltiplos condomínios.',
    ARRAY['3 condomínios','800 mensagens/mês','300 MB de documentos','Suporte prioritário'], 2),
  ('pj_starter',    'PJ Starter',    'pj', 597,  5,    2,    1500, 1024, 'Para administradoras pequenas.',
    ARRAY['5 condomínios','2 usuários','1500 mensagens/mês','1 GB de documentos'], 3),
  ('pj_enterprise', 'PJ Enterprise', 'pj', 1897, 20,   5,    6000, 5120, 'Para administradoras de médio porte.',
    ARRAY['20 condomínios','5 usuários','6000 mensagens/mês','5 GB de documentos','Onboarding dedicado'], 4),
  ('pj_ilimitado',  'PJ Ilimitado',  'pj', NULL, NULL, NULL, NULL, NULL, 'Plano customizado sob consulta.',
    ARRAY['Condomínios ilimitados','Usuários ilimitados','Mensagens ilimitadas','Storage ilimitado','SLA dedicado'], 5)
ON CONFLICT (id) DO UPDATE SET
  nome=EXCLUDED.nome, tipo_pessoa=EXCLUDED.tipo_pessoa, preco_mensal=EXCLUDED.preco_mensal,
  limite_condominios=EXCLUDED.limite_condominios, limite_usuarios=EXCLUDED.limite_usuarios,
  limite_mensagens_mes=EXCLUDED.limite_mensagens_mes, limite_storage_mb=EXCLUDED.limite_storage_mb,
  descricao=EXCLUDED.descricao, features=EXCLUDED.features, ordem=EXCLUDED.ordem, updated_at=now();

INSERT INTO public.creditos_avulsos (id, nome, quantidade_mensagens, preco, ordem) VALUES
  ('avulso_p','Pequeno',100,49,1),
  ('avulso_m','Médio',500,197,2),
  ('avulso_g','Grande',2000,597,3)
ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, quantidade_mensagens=EXCLUDED.quantidade_mensagens, preco=EXCLUDED.preco, ordem=EXCLUDED.ordem;

INSERT INTO public.blog_categorias (nome, slug, descricao, ordem) VALUES
  ('Jurisprudência','jurisprudencia','Decisões dos tribunais superiores sobre direito condominial.',1),
  ('Gestão','gestao','Boas práticas de gestão e administração de condomínios.',2),
  ('LGPD','lgpd','Proteção de dados pessoais em condomínios.',3)
ON CONFLICT (slug) DO NOTHING;

-- 14. Drop user_roles ---------------------------------------
DROP TABLE IF EXISTS public.user_roles CASCADE;
