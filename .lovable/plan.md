## Onda 3 — Blocos 7, 8 e 11

Vou executar em três sub-ondas para manter foco e custo controlados. Cada uma termina entregando algo utilizável.

---

### Sub-onda 3A — Bloco 7 (cadastro + auth + onboarding)

Parte do Bloco 7 já existe (signup PF/PJ, onboarding 3 passos, planos). Vou completar o que ficou faltando:

1. **`/signup`**: remover qualquer vestígio do campo OAB; garantir validação visual da senha (8+ caracteres, 1 letra + 1 número) com checkmarks verdes em tempo real; campo "Confirmar senha"; manter Nome, Email, Telefone, Tipo (PF/PJ → CPF / CNPJ + Razão Social), checkbox LGPD.
2. **Supabase Auth**:
   - desativar confirmação de e-mail para a fase de testes (`auto_confirm_email: true`);
   - `emailRedirectTo: ${window.location.origin}/onboarding` no `signUp`;
   - personalizar template de e-mail "Confirm signup" com identidade condoIA (sem menção a Lovable/Supabase).
3. **Redirect pós-signup**: ir direto para `/onboarding`, sem aguardar e-mail.
4. **Onboarding**: validar 3 passos — Passo 1 dados pré-preenchidos editáveis (com CNPJ/Razão Social para PJ), Passo 2 cards de planos filtrados por `tipo_pessoa`, com banner "3 dias de teste grátis", card "PJ Ilimitado" (preço NULL) com botão "Falar com consultor" que abre modal de contato; Passo 3 primeiro condomínio (com opção "Pular por enquanto").
5. **Trigger `handle_new_user`**: já está populando `tipo_pessoa`, `cpf_cnpj`, `razao_social` — só ajustar se faltar algo.

**Bloco 7 — área admin financeira:**

6. **`/app/admin/financeiro`** com 4 sub-abas:
   - **Receita**: MRR projetado (soma dos planos ativos), receita do mês, ticket médio, gráfico de evolução 6 meses.
   - **Custos**: custos por cliente do mês (tabela `custos_cliente_mensal`), totalizadores OpenAI + storage + outros.
   - **Margem**: receita − custos por cliente; lista de clientes deficitários.
   - **Despesas**: CRUD da tabela `despesas` (criar, editar, listar, categoria, valor, fornecedor, data).
7. **`/app/admin/clientes`**: CRUD completo — listar (já existe parcial em `app.admin.usuarios.tsx`), criar manualmente, editar (nome, telefone, tipo, plano, papel_sistema), conceder créditos avulsos, suspender/ativar.

---

### Sub-onda 3B — Bloco 8 (Blog público + admin)

1. **`/app/admin/blog`** com 3 abas:
   - **Posts**: listar, filtrar por status/categoria, criar/editar com editor markdown simples (textarea + preview), campos: título, slug, resumo, capa (upload), categoria, conteúdo, tags, status (rascunho/publicado), SEO (meta title/description).
   - **Categorias**: CRUD (`blog_categorias`).
   - **Configurações**: autor padrão.
2. **`/blog`** (público, dark):
   - hero com título e busca;
   - filtro lateral por categoria;
   - grid 3 colunas com cards (capa, categoria, título, resumo, autor, "Ler mais");
   - paginação 12 por página.
3. **`/blog/$slug`**:
   - breadcrumb;
   - header: badge categoria, título, resumo, meta (autor, data, tempo de leitura);
   - imagem de capa larga;
   - conteúdo markdown via `react-markdown` com classes `prose prose-invert`;
   - tags clicáveis;
   - sidebar (desktop): autor + 3 posts relacionados;
   - CTA final "Começar grátis".
4. **Landing — seção "Últimas publicações"**: 2 posts mais recentes em cards + botão "Ver todas".
5. **Seed**: inserir 2 posts de exemplo já publicados com os títulos sugeridos.

Dependência nova: `react-markdown` + `remark-gfm` + `@tailwindcss/typography` (Tailwind v4 — usar utilitário `prose`).

---

### Sub-onda 3C — Bloco 11 (checklist + ajustes finais)

Percorrer o checklist e ajustar pendências visuais/funcionais que aparecerem (ex.: logo no signup, banner trial, permissões dono vs operador, plano PJ Ilimitado com modal, trial sem bloqueio).

---

### Detalhes técnicos relevantes

- Sem mudanças destrutivas no schema; todas as tabelas necessárias (`planos`, `despesas`, `custos_cliente_mensal`, `blog_categorias`, `blog_posts`, `creditos_avulsos`) já existem.
- Novas server functions: `src/lib/admin-financeiro.functions.ts`, `src/lib/admin-clientes.functions.ts`, `src/lib/blog.functions.ts` (RPCs públicas para leitura via cliente publicável do servidor; mutações com `requireSupabaseAuth` + verificação `is_any_admin`).
- Blog público: rotas top-level `src/routes/blog.index.tsx` e `src/routes/blog.$slug.tsx` (SSR ligado, com `head()` para OG/SEO derivado do loader).
- Admin blog/financeiro: rotas sob `_authenticated/app.admin.*` reutilizando o guard de layout existente.
- Para a confirmação de e-mail desligada: vou chamar `supabase--configure_auth` com `auto_confirm_email: true` (apenas dev). Em produção, basta reativar pela mesma tela.
- Para o template de e-mail "Confirm signup": esse texto é editado no painel do projeto (não via SQL). Vou entregar o conteúdo pronto em copy para você colar — não há tool para escrever HTML do template programaticamente.

---

### Ordem de execução proposta

1. Sub-onda 3A → confirmo build limpo e devolvo.
2. Sub-onda 3B → blog completo, peço para publicar 2 posts reais ou aceitar o seed.
3. Sub-onda 3C → varredura final do checklist e correções pontuais.

Quer que eu siga nessa ordem ou prefere reordenar (ex.: blog antes do financeiro)?
