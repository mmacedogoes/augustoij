
# Fase 4 — Área administrativa + Treinamento da IA

Painel global em `/admin`, restrito a `user_roles.role = 'admin'`. Inclui métricas operacionais, gestão de usuários, auditoria **e** uma base de conhecimento global que treina a IA (jurisprudências, artigos, peças, diretrizes).

**Pode ser feito agora?** Sim. O projeto já usa a Lovable AI Gateway, que expõe `openai/text-embedding-3-small` (embeddings) e `google/gemini-3-flash-preview` (chat). Não precisa de chave OpenAI separada. A mesma pipeline RAG que processa documentos de condomínio é reaproveitada para a base global do administrador.

---

## 1. Banco de dados (migração additiva)

Sem mexer em tabelas existentes.

**Tabelas novas:**

- `public.admin_audit_log` — `id, actor_user_id, action, target_user_id?, target_condominio_id?, target_kb_id?, metadata jsonb, created_at`. RLS: SELECT só admin; INSERT só via funções `SECURITY DEFINER`.
- `public.kb_documentos` — base global de conhecimento jurídico:
  `id, titulo, tipo (enum: jurisprudencia | doutrina | lei | peca | orientacao | outro), fonte text, url text?, storage_path text?, conteudo_bruto text?, status_processamento, created_by uuid, created_at`. RLS: SELECT para `authenticated` (todo usuário pode se beneficiar), INSERT/UPDATE/DELETE só admin.
- `public.kb_chunks` — chunks vetorizados da base global:
  `id, kb_documento_id, conteudo text, embedding vector(1536), metadata jsonb, created_at`. Índice HNSW cosine. RLS: SELECT `authenticated`; escrita só `service_role`.
- `public.ai_orientacoes` — diretrizes textuais do admin que viram parte do system prompt:
  `id, titulo, conteudo text, ativo bool default true, ordem int default 0, updated_by uuid, updated_at`. RLS: SELECT `authenticated`; escrita só admin. Limite prático: ~10 entradas ativas (validado na UI).

**Funções `SECURITY DEFINER`:**

- `admin_dashboard_metrics()` — totais de usuários, condomínios, documentos, mensagens/tokens/custo do mês, itens na KB.
- `admin_list_users(_search, _limit, _offset)` — perfis + papel + plano + uso do mês + qtd. de condomínios.
- `admin_usage_timeseries(_days)` — mensagens/dia (últimos 30 dias).
- `match_kb_chunks(_query_embedding vector(1536), _match_count int, _min_similarity float)` — busca semântica na base global (sem filtro por condomínio). Não exige admin; qualquer usuário autenticado pode consultar (é via chat).

**Bucket de storage:** `kb-documentos` (privado). Policy: SELECT/INSERT/DELETE só admin.

**Trigger:** ajuste leve em `tg_update_uso_mensal` para também incrementar `uso_mensal.custo_estimado_brl` (tarifa aproximada R$ 0,000015/token, constante na função).

---

## 2. Pipeline de treinamento

Reutiliza o que já existe em `src/lib/documentos.server.ts` (extração PDF/DOCX/TXT + chunking) e `src/lib/ai-gateway.server.ts` (`embedText`).

Server functions em `src/lib/admin-kb.functions.ts` (todas com `requireSupabaseAuth` + checagem `has_role(...,'admin')`):

- `listKbDocumentos({ search, tipo })` — lista da base global.
- `createKbDocumentoTexto({ titulo, tipo, fonte, conteudo })` — cola direta de texto (jurisprudência, artigo curto). Vai direto para chunking + embeddings.
- `getKbUploadUrl({ nomeArquivo })` — URL assinada no bucket `kb-documentos`.
- `createKbDocumentoArquivo({ titulo, tipo, fonte, storagePath, nomeArquivo })` — registra metadados, dispara processamento.
- `processKbDocumento({ id })` — baixa arquivo (se houver) → extrai texto → chunking → embeddings → insere em `kb_chunks` (admin client). Idêntico ao fluxo de `processDocumento`, mas grava em `kb_chunks` sem `condominio_id`.
- `deleteKbDocumento({ id })` — remove chunks, storage e linha.
- `listOrientacoes()` / `upsertOrientacao({ id?, titulo, conteudo, ativo, ordem })` / `deleteOrientacao({ id })`.

Toda ação grava em `admin_audit_log`.

---

## 3. Integração ao chat (RAG ampliado)

`src/routes/api/chat.ts` passa a montar contexto a partir de **duas fontes**:

1. `match_document_chunks(condominio_id, ...)` — documentos privados do condomínio (top 6).
2. `match_kb_chunks(query_embedding, ...)` — base global do admin (top 4, similaridade ≥ 0.35).

System prompt passa a incluir:

- Persona atual ("assistente jurídico…").
- **Bloco "Diretrizes do administrador":** concatenação de `ai_orientacoes` onde `ativo = true`, ordenado por `ordem`. Limitado a ~3.000 caracteres.
- Contexto dos chunks (documentos do condomínio + KB global), com rotulação clara: `[Documento do condomínio: …]` vs `[Base de conhecimento: <título> — <fonte>]`.
- Disclaimer OAB obrigatório.

Sem mudança no front-end do chat.

---

## 4. Rotas e UI

Subtree `/admin` (gate em `beforeLoad` chamando `assertAdmin` server-side):

```text
/admin                 → métricas + gráfico + últimos eventos
/admin/usuarios        → tabela, busca, promover/remover admin
/admin/condominios     → tabela global de condomínios
/admin/treinamento     → base global da IA (KB)
/admin/orientacoes     → diretrizes textuais para o system prompt
/admin/auditoria       → eventos sensíveis
```

**`/admin/treinamento`:**
- Abas: "Documentos" (upload PDF/DOCX/TXT) e "Texto colado" (textarea grande com título/tipo/fonte).
- Lista com filtros por tipo (jurisprudência, doutrina, lei, peça, orientação, outro), status (processando/pronto/erro), busca por título.
- Excluir com confirmação.
- Polling leve enquanto houver itens em `processando`.

**`/admin/orientacoes`:**
- Lista das diretrizes ativas/inativas com toggle e ordenação.
- Editor por entrada (título + conteúdo Markdown, limite 1.000 caracteres por entrada). Pré-visualização do system prompt resultante.
- Aviso: "Estas orientações são enviadas em toda resposta — seja conciso para não inflar custo."

`AppShell` ganha item "Admin" no menu lateral, visível somente quando `getCurrentUserRoles()` indicar admin (cacheado via TanStack Query).

---

## 5. Segurança

- Defesa em camadas: gate na rota (`beforeLoad`) + checagem em cada server fn + RLS no banco + `SECURITY DEFINER` interno verificando `has_role`.
- `supabaseAdmin` só carregado dentro de handlers, após validar admin.
- `match_kb_chunks` exposto a todo `authenticated` (alimenta o chat), mas `kb_documentos` e `kb_chunks` têm escrita travada.
- Bloqueio para o último admin não conseguir se auto-rebaixar.
- Toda ação de admin (promover, treinar, apagar) registra em `admin_audit_log`.

---

## 6. Custos e limites

- Embeddings de treinamento consomem créditos da workspace — mesma tarifa do upload normal de documentos. Surfaço 402/429 com mensagem clara.
- Limite prático na UI: arquivos até 10 MB, texto colado até 200 KB por entrada.
- Diretrizes ativas limitadas a 10 entradas e ~3.000 caracteres totais para não estourar a janela de contexto.

---

## 7. Fora do escopo

- Stripe (Fase 3).
- Convidar co-síndicos (Fase 5).
- Export PDF de conversas (Fase 5).
- Versionamento/aprovação de orientações (futuro).
- Reprocessar todos os chunks ao trocar de modelo de embedding (futuro, ao migrar para `gemini-embedding-001`).

---

## 8. Verificações finais

- `tsgo` limpo.
- `/admin/*` retorna redirect para não-admin (testado com `invoke-server-function`).
- Após criar uma entrada na KB, uma pergunta no chat traz o trecho citado como `[Base de conhecimento: ...]`.
- Linter Supabase sem novos warnings críticos.

Confirma para eu começar pela migração SQL + bucket e seguir com as server functions e telas?
