
ALTER TABLE public.condominios ADD COLUMN IF NOT EXISTS cidade TEXT;

CREATE TABLE public.cidades_cobertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cidades_cobertas TO authenticated;
GRANT ALL ON public.cidades_cobertas TO service_role;
ALTER TABLE public.cidades_cobertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cidades_cobertas_select_auth" ON public.cidades_cobertas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cidades_cobertas_admin_all" ON public.cidades_cobertas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.cidades_novas_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  primeiro_condominio_id UUID REFERENCES public.condominios(id) ON DELETE SET NULL,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','resolvida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvida_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cidades_novas_alertas TO authenticated;
GRANT ALL ON public.cidades_novas_alertas TO service_role;
ALTER TABLE public.cidades_novas_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cidades_novas_admin_all" ON public.cidades_novas_alertas FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.cidades_cobertas (cidade, uf, slug) VALUES
  ('João Pessoa','PB','joao pessoa|PB'),
  ('Cabedelo','PB','cabedelo|PB'),
  ('Campina Grande','PB','campina grande|PB');
