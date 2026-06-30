
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_tour_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dicas_ativas boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.dicas_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  categoria text NOT NULL DEFAULT 'operacional',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dicas_sistema TO authenticated;
GRANT ALL ON public.dicas_sistema TO service_role;

ALTER TABLE public.dicas_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dicas_sel_auth" ON public.dicas_sistema;
CREATE POLICY "dicas_sel_auth" ON public.dicas_sistema
  FOR SELECT TO authenticated USING (ativo = true);

DROP POLICY IF EXISTS "dicas_admin_all" ON public.dicas_sistema;
CREATE POLICY "dicas_admin_all" ON public.dicas_sistema
  FOR ALL TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_dicas_updated_at ON public.dicas_sistema;
CREATE TRIGGER trg_dicas_updated_at
  BEFORE UPDATE ON public.dicas_sistema
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.dicas_sistema (texto, categoria, ordem) VALUES
('Já cadastrou a Convenção e o Regimento Interno do seu condomínio? Isso turbina a precisão das respostas.', 'operacional', 1),
('Ao pedir um documento, peça à IA que faça perguntas antes — assim a resposta sai mais ajustada.', 'interacao_ia', 2),
('Seja específico nos comandos. "Notificação para o morador da 502 por barulho ontem às 22h" rende mais que "fazer notificação".', 'interacao_ia', 3),
('Anexe documentos diretamente na conversa para análises pontuais sem precisar cadastrar permanentemente.', 'recursos', 4),
('Use o seletor no topo para alternar entre condomínios sem perder o histórico.', 'operacional', 5),
('A IA responde melhor quando você informa o perfil correto. Edite em Conta > Dados Pessoais se mudou de função.', 'operacional', 6),
('Pergunte "como posso aplicar isso na prática?" ao final de uma resposta jurídica para receber orientação prática.', 'interacao_ia', 7),
('Ao analisar contratos, peça à IA o parecer pormenorizado com semáforo vermelho/amarelo/verde por cláusula.', 'interacao_ia', 8),
('Documentos escaneados (sem texto digital) são lidos automaticamente — mas a qualidade da imagem importa.', 'recursos', 9),
('Você pode reabrir qualquer conversa antiga no Histórico e continuar de onde parou.', 'recursos', 10),
('Para temas reincidentes (mesma unidade, mesma infração), a IA detecta e sugere progressão de sanções.', 'interacao_ia', 11),
('Mantenha as atas das últimas 3 assembleias sempre carregadas — a IA usa como contexto em qualquer pergunta.', 'operacional', 12)
ON CONFLICT DO NOTHING;
