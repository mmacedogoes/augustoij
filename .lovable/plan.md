# Plan: Módulo de Assembleias - Fundação de Dados

Construção do banco de dados para o módulo de Assembleias, mantendo isolamento estrito conforme regras de não-regressão.

## Passos da Migração

1. **Extensões e Funções Utilitárias**
   - Habilitar `pgcrypto`.
   - Função `assembleia_gerar_recibo()`.
   - Função `normalizar_telefone_br(text)`.
   - Função `assembleia_verificar_integridade(uuid)`.

2. **Criação de Tabelas (Esquema Public)**
   - Criar as 25+ tabelas conforme especificação (Core, Votação, IA, Convocação).
   - Aplicar `tg_set_updated_at` e triggers de normalização (`tg_convocacao_destinatario_normalizar`).

3. **Segurança e RLS**
   - Aplicar políticas de RLS restritas a `is_super_admin(auth.uid())` para todas as tabelas (exceto exceções).
   - Implementar exceções específicas (`assembleia_votos`, etc).
   - Executar `GRANT`s necessários (`authenticated`, `service_role`).

4. **Storage**
   - Criar buckets `assembleia-planilhas`, `assembleia-gravacoes`, `assembleia-procuracoes`.
   - Aplicar políticas de acesso restritas a Super Admin e `service_role`.

5. **Validação**
   - Executar testes de integridade, bloqueio de edição de votos e normalização de telefone.
