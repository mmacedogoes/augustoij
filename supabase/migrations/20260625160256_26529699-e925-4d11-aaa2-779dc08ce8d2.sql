
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'sindico', 'administradora');
CREATE TYPE public.papel_condominio AS ENUM ('sindico', 'subsindico', 'conselheiro', 'colaborador');
CREATE TYPE public.tipo_documento AS ENUM ('convencao', 'regimento', 'ata', 'contrato', 'outro');
CREATE TYPE public.plano_assinatura AS ENUM ('solo', 'pro', 'administradora');
CREATE TYPE public.papel_mensagem AS ENUM ('user', 'assistant');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  telefone TEXT,
  oab TEXT,
  email TEXT,
  lgpd_aceite_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ has_role function ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ Trigger: auto-create profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, oab, lgpd_aceite_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'oab',
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_aceite')::boolean IS TRUE THEN now() ELSE NULL END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CONDOMINIOS ============
CREATE TABLE public.condominios (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  uf TEXT,
  qtd_unidades INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominios TO authenticated;
GRANT ALL ON public.condominios TO service_role;
ALTER TABLE public.condominios ENABLE ROW LEVEL SECURITY;

-- ============ CONDOMINIO MEMBERS ============
CREATE TABLE public.condominio_members (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel_no_condominio public.papel_condominio NOT NULL DEFAULT 'sindico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(condominio_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.condominio_members TO authenticated;
GRANT ALL ON public.condominio_members TO service_role;
ALTER TABLE public.condominio_members ENABLE ROW LEVEL SECURITY;

-- helper function to avoid recursion in policies
CREATE OR REPLACE FUNCTION public.is_condominio_member(_condominio_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.condominios c WHERE c.id = _condominio_id AND c.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.condominio_members m WHERE m.condominio_id = _condominio_id AND m.user_id = _user_id
  )
$$;

-- condominios policies
CREATE POLICY "condominios_select_member" ON public.condominios FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_condominio_member(id, auth.uid()));
CREATE POLICY "condominios_insert_owner" ON public.condominios FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());
CREATE POLICY "condominios_update_owner" ON public.condominios FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "condominios_delete_owner" ON public.condominios FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- condominio_members policies
CREATE POLICY "members_select_own_or_owner" ON public.condominio_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid())
);
CREATE POLICY "members_insert_owner" ON public.condominio_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));
CREATE POLICY "members_delete_owner" ON public.condominio_members FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.condominios c WHERE c.id = condominio_id AND c.owner_id = auth.uid()));

-- ============ DOCUMENTOS ============
CREATE TABLE public.documentos (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  tipo public.tipo_documento NOT NULL DEFAULT 'outro',
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status_processamento TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_select_member" ON public.documentos FOR SELECT TO authenticated
USING (public.is_condominio_member(condominio_id, auth.uid()));
CREATE POLICY "documentos_insert_member" ON public.documentos FOR INSERT TO authenticated
WITH CHECK (public.is_condominio_member(condominio_id, auth.uid()));
CREATE POLICY "documentos_delete_member" ON public.documentos FOR DELETE TO authenticated
USING (public.is_condominio_member(condominio_id, auth.uid()));

-- ============ DOCUMENT CHUNKS ============
CREATE TABLE public.document_chunks (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_member" ON public.document_chunks FOR SELECT TO authenticated
USING (public.is_condominio_member(condominio_id, auth.uid()));

CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX document_chunks_condominio_idx ON public.document_chunks(condominio_id);

-- ============ CONVERSAS ============
CREATE TABLE public.conversas (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT,
  skill_ativa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT ALL ON public.conversas TO service_role;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_select_own" ON public.conversas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conversas_insert_own" ON public.conversas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_condominio_member(condominio_id, auth.uid()));
CREATE POLICY "conversas_update_own" ON public.conversas FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "conversas_delete_own" ON public.conversas FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ MENSAGENS ============
CREATE TABLE public.mensagens (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  papel public.papel_mensagem NOT NULL,
  conteudo TEXT NOT NULL,
  tokens_usados INTEGER DEFAULT 0,
  model_usado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mensagens TO authenticated;
GRANT ALL ON public.mensagens TO service_role;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_select_own" ON public.mensagens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid()));
CREATE POLICY "mensagens_insert_own" ON public.mensagens FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid()));

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plano public.plano_assinatura NOT NULL DEFAULT 'solo',
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ USO MENSAL ============
CREATE TABLE public.uso_mensal (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano TEXT NOT NULL,
  total_mensagens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  custo_estimado_brl NUMERIC(10,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_ano)
);
GRANT SELECT ON public.uso_mensal TO authenticated;
GRANT ALL ON public.uso_mensal TO service_role;
ALTER TABLE public.uso_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso_mensal_select_own" ON public.uso_mensal FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ updated_at helpers ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_condominios_updated_at BEFORE UPDATE ON public.condominios FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_uso_mensal_updated_at BEFORE UPDATE ON public.uso_mensal FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
