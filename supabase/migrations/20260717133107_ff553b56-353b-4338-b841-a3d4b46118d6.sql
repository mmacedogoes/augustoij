
-- Permite que usuários autenticados leiam apenas as orientações ATIVAS,
-- para que o system prompt do chat volte a incluí-las.
-- Escritas seguem restritas ao super admin (políticas existentes).
DROP POLICY IF EXISTS ai_orientacoes_authenticated_read_active ON public.ai_orientacoes;
CREATE POLICY ai_orientacoes_authenticated_read_active
  ON public.ai_orientacoes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (ativo = true);
