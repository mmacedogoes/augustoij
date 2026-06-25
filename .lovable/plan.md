
# CondoIA — Plano da Fase 1

Você pediu muita coisa de uma vez. Para entregar com qualidade, vou dividir em fases e implementar agora só o que você marcou como "começar": estrutura, schema completo no Supabase com RLS, páginas públicas, login/cadastro funcional e dashboard vazio. Chat com RAG, upload vetorizado, Stripe e área admin ficam para iterações seguintes (mas o schema já contempla tudo).

## O que entra agora (Fase 1)

### 1. Infraestrutura
- Habilitar **Lovable Cloud** (Supabase gerenciado — auth, banco, storage, edge functions, pgvector).
- Criar bucket de Storage `documentos` (privado, RLS por condomínio) — pronto para o upload da fase 2.
- Configurar design system em `src/styles.css`: paleta azul-marinho `#1E3A5F`, esmeralda `#10B981`, branco; fonte Inter via `<link>` no `__root.tsx`; tokens semânticos (primary, accent, etc.) em `oklch`.

### 2. Schema do banco + RLS (migration única)
Tabelas exatamente como você especificou:
`profiles`, `subscriptions`, `condominios`, `condominio_members`, `documentos`, `document_chunks` (vector(1536) + índice ivfflat), `conversas`, `mensagens`, `uso_mensal`.

Padrões obrigatórios:
- Enum separado `app_role` (`owner`, `admin`, `sindico`, `administradora`) e tabela `user_roles` para evitar escalonamento de privilégio. `profiles.papel` **não** é fonte de verdade para autorização — uso a função `has_role(uuid, app_role)` `SECURITY DEFINER`.
- Trigger `on_auth_user_created` cria `profiles` automaticamente no signup.
- RLS habilitado em todas as tabelas + `GRANT`s explícitos para `authenticated` / `service_role`.
- Função `is_condominio_member(condo_id, user_id)` `SECURITY DEFINER` para evitar recursão nas policies de documentos/chunks/conversas.
- Policies:
  - `condominios`: SELECT/UPDATE/DELETE se owner ou membro; INSERT se `owner_id = auth.uid()`.
  - `documentos` / `document_chunks`: visíveis apenas para membros do condomínio.
  - `conversas` / `mensagens`: visíveis apenas para `user_id = auth.uid()`.
  - `subscriptions` / `uso_mensal`: SELECT só do próprio user; writes só via `service_role`.
  - Tabelas administrativas: acesso só via `has_role(auth.uid(), 'owner')`.

### 3. Auth (Supabase)
- Email + senha, com `emailRedirectTo: window.location.origin`.
- Listener `onAuthStateChange` no `__root.tsx` (filtrado para SIGNED_IN/OUT/USER_UPDATED).
- Layout protegido em `src/routes/_authenticated/route.tsx` (gerenciado pela integração, `ssr: false`, redireciona para `/auth`).
- Validação de formulários com `zod`.

### 4. Páginas (rotas TanStack Start, uma por arquivo, com `head()` próprio)

Públicas:
- `/` — landing: hero, 3 benefícios, demo das 6 skills, tabela de 3 planos (Solo R$ 297, Pro R$ 597, Administradora R$ 1.997), FAQ, CTA de trial 7 dias. CTAs vão para `/signup`.
- `/login` — email + senha.
- `/signup` — nome, email, senha, OAB (opcional), checkbox de aceite Termos+LGPD (obrigatório, grava `lgpd_aceite_em`).
- `/termos` e `/privacidade` — conteúdo base em pt-BR (você revisa depois com seu jurídico).

Autenticadas (sob `_authenticated/`):
- `/app` — dashboard: saudação com nome, cards dos condomínios (vazio com CTA se nenhum), card de uso do mês (zerado), atalhos visuais das 6 skills (ainda sem ação).
- `/app/condominios` — lista + botão "novo condomínio" (modal funcional criando registro real).
- `/app/condominios/$id` — abas Documentos / Chat / Histórico / Configurações como placeholders prontos para Fase 2.
- `/app/conta` — dados do perfil e card "plano: trial" (botão Stripe desabilitado por enquanto).

### 5. Server functions (Fase 1)
- `getMyCondominios`, `createCondominio`, `getCondominio`, `updateProfile` — todas com `requireSupabaseAuth`, RLS faz o trabalho pesado.

### 6. SEO / qualidade
- `sitemap.xml` + `robots.txt`.
- `head()` único por rota pública (title, description, og:*).
- Mobile-responsive, foco visível, contraste WCAG AA.

## O que NÃO entra agora (próximas iterações, já confirmadas no roadmap)
- **Fase 2** — Upload de PDF/DOCX + edge function de vetorização (chunking + `text-embedding-3-small` + insert em `document_chunks`).
- **Fase 3** — Chat com RAG (busca por similaridade no pgvector, montagem de prompt, GPT-4o / 4o-mini, disclaimer fixo, export PDF, contador de uso, bloqueio por plano).
- **Fase 4** — Stripe (Checkout, Customer Portal, webhook `/api/public/webhooks/stripe`, trial 7 dias, 3 produtos).
- **Fase 5** — Área admin (`/admin`, `/admin/users`, `/admin/logs`) com métricas de MRR/churn/custo OpenAI.

## Decisões técnicas (resumo para você, mesmo se não-técnico)
- Uso o backend nativo do Lovable (Lovable Cloud) — sem precisar criar conta em lugar nenhum. Já inclui banco PostgreSQL, autenticação, storage de arquivos e funções serverless.
- Papéis de usuário ficam numa tabela separada (`user_roles`) — exigência de segurança para evitar que alguém consiga "se promover" a admin via API.
- Toda tabela tem regras de acesso (RLS) — atende LGPD na camada de banco, não só na aplicação.
- Stripe e OpenAI serão ligados nas próximas fases; quando chegarmos lá vou te pedir as chaves de API no momento certo (Stripe é integração nativa, não precisa de chave manual).

## Pergunta antes de executar
Confirma esse escopo da Fase 1? Se sim, eu já habilito o Lovable Cloud e começo a implementar.
