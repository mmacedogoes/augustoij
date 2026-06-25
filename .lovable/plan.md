
# CondoIA — Fase 2: Documentos + Chat com IA (RAG)

Tudo necessário já está disponível: Lovable AI Gateway (`LOVABLE_API_KEY` configurada), banco com `document_chunks` (pgvector) e RLS por membro de condomínio. Falta criar o bucket de storage, a pipeline de ingestão e o chat com busca semântica.

## Escopo desta fase

### 1. Storage e migration de suporte

- Criar bucket privado **`documentos`** com policies de RLS em `storage.objects`: somente membros do condomínio podem `SELECT`/`INSERT`/`DELETE` arquivos cujo path começa com `<condominio_id>/...`.
- Ajustar a coluna `document_chunks.embedding` para **`vector(1536)`** (alinha com `openai/text-embedding-3-small` no Gateway) e criar índice HNSW `vector_cosine_ops`.
- Adicionar função SQL `match_document_chunks(_condominio_id uuid, query_embedding vector(1536), match_count int)` `SECURITY DEFINER`, que filtra por condomínio e retorna `documento_id, nome_arquivo, conteudo, similarity` ordenado por cosine distance.
- Trigger para atualizar `uso_mensal` (mensagens/tokens) a cada `mensagens.INSERT` do papel `assistant`.

### 2. Upload e processamento de documentos (`/app/condominios/$id` → aba Documentos)

UI:
- Drag-and-drop / botão "Enviar documento" aceitando PDF e DOCX (limite 10 MB).
- Lista de documentos do condomínio com nome, tipo, status (`processando` / `pronto` / `erro`) e botão de excluir.
- Polling leve (a cada 3 s) enquanto houver itens em `processando`.

Server functions (`src/lib/documentos.functions.ts`):
- `listDocumentos({ condominioId })` — leitura via RLS.
- `getUploadUrl({ condominioId, nomeArquivo, tipo })` — gera URL assinada de upload no bucket `documentos`.
- `processDocumento({ documentoId })` — handler que:
  1. Baixa o arquivo pelo `storage_path` (admin client).
  2. Extrai texto: PDF via **`unpdf`** (compatível com Workers), DOCX via **`mammoth`**.
  3. Faz chunking ~1.000 chars com overlap de 150.
  4. Chama o Gateway `/embeddings` (modelo `openai/text-embedding-3-small`, `dimensions: 1536`) por chunk em lotes.
  5. Insere em `document_chunks` (`condominio_id`, `documento_id`, `conteudo`, `embedding`, `metadata`).
  6. Atualiza `documentos.status_processamento` ao final.
- `deleteDocumento({ id })` — remove chunks, objeto no storage e linha em `documentos`.

Todas autenticadas via `requireSupabaseAuth`; a checagem de pertencimento ao condomínio fica a cargo de RLS + `is_condominio_member`.

### 3. Chat com IA + RAG (aba Chat)

- Rota server route `src/routes/api/chat.ts` (POST, streaming) usando AI SDK + helper Lovable AI Gateway (`createLovableAiGatewayProvider`). Modelo default: `google/gemini-3-flash-preview`.
- Recebe `{ conversaId, condominioId, messages }`. Valida com Zod e autentica via bearer (lê o token do header, reusa cliente Supabase publishable + JWT do usuário para checar `is_condominio_member`).
- Pipeline por requisição:
  1. Gera embedding da última mensagem do usuário (`text-embedding-3-small`, 1536 dims).
  2. Chama `match_document_chunks` (top 6, similaridade ≥ 0.3).
  3. Monta system prompt em pt-BR: persona "assistente jurídico de condomínios", contexto dos chunks com citação `[Documento: nome — trecho N]`, disclaimer obrigatório de que não substitui parecer da OAB.
  4. Faz `streamText` com histórico das últimas 20 mensagens da conversa + nova mensagem.
  5. `onFinish`: persiste `mensagens` (user e assistant), atualiza `conversas.titulo` se for a primeira mensagem (gera título curto via Gateway).
- Server function `getOrCreateConversa({ condominioId, conversaId? })` e `listMensagens({ conversaId })`.

UI da aba Chat (`src/components/chat/ChatPanel.tsx`) usando **AI Elements** (`conversation`, `message`, `prompt-input`, `shimmer`):
- Render markdown com `MessageResponse`.
- Indicador "Pensando..." enquanto `status === 'submitted' | 'streaming'`.
- Rodapé fixo com disclaimer LGPD/OAB.
- Bloqueio quando o condomínio não tem documentos prontos ("Envie ao menos um documento para iniciar").

### 4. Histórico (aba Histórico)

- Lista de `conversas` do condomínio com data, título e botão "Abrir" (carrega o chat com aquela conversa) e "Excluir".

### 5. Telemetria de uso

- Trigger SQL incrementa `uso_mensal.total_mensagens` e `total_tokens` (somando `mensagens.tokens_usados`) por user_id no mês corrente.
- Card "Mensagens este mês" do dashboard passa a refletir dado real (já está conectado a `getUsoMensal`).

### 6. SEO / qualidade

- Sem mudanças em rotas públicas.
- Tratamento de erros 402/429 do Gateway com toast claro ("Créditos esgotados — contate o admin" / "Muitas requisições, tente novamente em instantes").

## Dependências npm a instalar
`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `unpdf`, `mammoth`, AI Elements (`bun x ai-elements@latest add conversation message prompt-input shimmer`).

## Fora do escopo (próximas fases)
- **Fase 3** — Stripe (Checkout, Customer Portal, webhook), planos Solo/Pro/Administradora, limites por plano.
- **Fase 4** — Área admin (`/admin`) com métricas MRR/churn/custo, gestão de usuários.
- **Fase 5** — Convidar co-síndicos / colaboradores (`condominio_members`), export PDF de conversas.

## Riscos técnicos
- `unpdf`/`mammoth` rodam em Worker, mas PDFs escaneados (imagem) não terão OCR — sinalizamos status `erro` com mensagem clara.
- Embeddings em lote consomem créditos da workspace — surfaço 402 explicitamente.
- Cosine threshold (0.3) pode precisar de ajuste após teste com documentos reais.

Confirma esse escopo? Se sim, parto direto para a migration + bucket e sigo com a pipeline.
