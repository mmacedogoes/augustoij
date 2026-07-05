
-- Consent + marketing columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
  ADD COLUMN IF NOT EXISTS termos_versao text,
  ADD COLUMN IF NOT EXISTS termos_ip text;

-- Solicitações de exportação de dados
CREATE TABLE IF NOT EXISTS public.solicitacoes_exportacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  entregue_em timestamptz
);
GRANT SELECT, INSERT ON public.solicitacoes_exportacao TO authenticated;
GRANT ALL ON public.solicitacoes_exportacao TO service_role;
ALTER TABLE public.solicitacoes_exportacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titular vê suas exportações" ON public.solicitacoes_exportacao
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "titular solicita exportação" ON public.solicitacoes_exportacao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Solicitações de exclusão de conta
CREATE TABLE IF NOT EXISTS public.solicitacoes_exclusao_conta (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  token_confirmacao uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  suspende_em timestamptz,
  excluir_em timestamptz,
  ip text
);
GRANT SELECT, INSERT ON public.solicitacoes_exclusao_conta TO authenticated;
GRANT ALL ON public.solicitacoes_exclusao_conta TO service_role;
ALTER TABLE public.solicitacoes_exclusao_conta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titular vê sua exclusão" ON public.solicitacoes_exclusao_conta
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "titular solicita exclusão" ON public.solicitacoes_exclusao_conta
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Rate limiting (server-only)
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  ip text NOT NULL,
  kind text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate timestamptz,
  PRIMARY KEY (ip, kind)
);
GRANT ALL ON public.auth_rate_limits TO service_role;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- sem policies: apenas service_role acessa
