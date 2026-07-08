
## Diagnóstico

Hoje o dashboard "Usos e custos" é alimentado **exclusivamente** pelo trigger `tg_update_uso_mensal`, que roda **apenas quando uma linha é inserida em `public.mensagens` com `papel='assistant'`**. Esse insert existe em um único lugar: `src/routes/api/chat.ts` (o chat conversacional). O trigger é quem popula `uso_mensal`, `uso_diario` e `custos_cliente_mensal`.

Verificando os outros consumidores da Lovable AI Gateway no projeto (todos usam `LOVABLE_API_KEY` e portanto **queimam créditos reais**):

| Arquivo | O que faz | Registra em `mensagens`/uso? |
|---|---|---|
| `src/routes/api/chat.ts` | Chat com o usuário | **Sim** (único caso hoje) |
| `src/lib/unidades-ia.functions.ts` | Extrai unidades da convenção (`generateText` + prompt grande, às vezes com retry) | **Não** |
| `src/lib/documentos.functions.ts` / `documentos.server.ts` | Chunk + `embedText`/`embedChunksParallel` de cada documento enviado (dezenas a centenas de embeddings por PDF) | **Não** |
| `src/lib/admin-kb.functions.ts` | Ingestão de KB jurídica (embeddings + eventual chat) | **Não** |
| `src/routes/api/public/demo-chat.ts` | Chat público de demo na landing | **Não** |

Ou seja: **cada convenção importada, cada PDF processado e cada documento da KB consome créditos Lovable que somem do dashboard**. O sintoma que você observou (créditos gastos na leitura de documentos sem aparecer em uso/custo) é exatamente esse ponto cego.

Fatores agravantes:
1. `embedText` não retorna a contagem de tokens do provedor (o helper descarta o campo `usage` da resposta do gateway).
2. `custos_cliente_mensal.custo_embeddings` está fixado em `0` pelo trigger, e `refresh_custos_cliente_mensal` também zera — não há caminho para embeddings entrarem no custo.
3. Não há tabela dedicada de "eventos de IA" fora do chat, então hoje um consumo de importação não deixa rastro nem em `mensagens`, nem em `uso_mensal`, nem em `custos_cliente_mensal`.

## Possíveis soluções

### Opção A — Registrar cada chamada em uma nova tabela `eventos_ia` (recomendada)
Criar `public.eventos_ia (id, user_id, condominio_id, origem, model, tokens_input, tokens_output, creditos_lovable, aig_log_id, aig_run_id, created_at)` com RLS por dono, e um trigger `AFTER INSERT` que agrega em `uso_mensal` / `uso_diario` / `custos_cliente_mensal` reaproveitando a mesma fórmula do trigger de mensagens (créditos × `credito_brl`).
- **Vantagem:** rastreia origem ("importacao_convencao", "embedding_documento", "kb_ingest", "demo_chat"), permite filtrar no admin e não polui a tabela `mensagens` (que é conversacional).
- **Custo:** uma migração + wrapper `registrarEventoIa()` chamado nos 4 pontos acima.

### Opção B — Reusar `mensagens` com um `papel` novo (ex.: `sistema_ia`)
Inserir uma linha "fantasma" em `mensagens` (sem conversa real ou com uma conversa técnica por condomínio) e adaptar o trigger para contar essas linhas também.
- **Vantagem:** aproveita todo o pipeline atual, mudança mínima.
- **Desvantagem:** mistura chat do usuário com uso interno; complica listagens da conversa; força criar `conversa_id` sintético.

### Opção C — Contabilizar só nos totais (mais simples, menos rastreável)
Após cada chamada de IA fora do chat, chamar diretamente um RPC `registrar_uso_ia(user_id, tokens_in, tokens_out, model, origem)` que faz o `INSERT ... ON CONFLICT` em `uso_mensal`/`uso_diario`/`custos_cliente_mensal`.
- **Vantagem:** sem tabela nova; corrige o dashboard imediatamente.
- **Desvantagem:** perde detalhe por evento (não dá para auditar qual PDF gerou o custo).

## Plano recomendado (Opção A + captura de tokens de embeddings)

Objetivo: **cada crédito Lovable consumido aparece no dashboard, com origem**.

### 1. Migração
- Nova tabela `public.eventos_ia` com colunas acima, `owner_id NOT NULL`, índice `(user_id, created_at DESC)` e `(user_id, mes_ano)`.
- `GRANT SELECT, INSERT ON public.eventos_ia TO authenticated;` + `GRANT ALL ... TO service_role;`
- RLS: SELECT/INSERT `TO authenticated USING (auth.uid() = user_id)`; admin lê tudo via `is_any_admin`.
- Trigger `AFTER INSERT`: soma `creditos_lovable` e tokens em `uso_mensal.total_credits/total_tokens`, `custo_estimado_brl`, e em `custos_cliente_mensal.custo_tokens_openai` (para eventos de chat/prompt) **ou** `custos_cliente_mensal.custo_embeddings` (quando `origem` começa com `embedding_`). NÃO incrementa `total_mensagens` para não distorcer contagem de mensagens do plano — o limite de mensagens do usuário continua vindo só de `mensagens.papel='assistant'`.
- Ajustar `refresh_custos_cliente_mensal` para agregar embeddings a partir de `eventos_ia` em vez de forçar `0`.

### 2. Helper server-side `src/lib/uso-ia.server.ts`
```ts
registrarEventoIa({ userId, condominioId?, origem, model,
  tokensInput, tokensOutput, aigLogId?, aigRunId? })
```
Calcula créditos a partir de `model_pricing` (mesmo caminho do chat), grava em `eventos_ia`. Falhas viram `console.error` — nunca quebram o fluxo do usuário.

### 3. Instrumentar os 4 chamadores
- `src/lib/unidades-ia.functions.ts`: após `generateText`, chamar `registrarEventoIa({ origem: "importacao_convencao", ... })` usando `result.usage` e o `X-Lovable-AIG-Log-ID` capturado.
- `src/lib/ai-gateway.server.ts`: fazer `embedText` retornar `{ embedding, usage }` e adicionar um callback opcional `onUsage(usage)` em `embedText`/`embedChunksParallel`; `documentos.server.ts`, `documentos.functions.ts` e `admin-kb.functions.ts` passam esse callback para registrar `origem: "embedding_documento"` ou `"embedding_kb"` (um evento agregado por documento, com soma dos tokens — não um por chunk, para não poluir).
- `src/routes/api/public/demo-chat.ts`: registrar com `origem: "demo_chat"`, `user_id` null (ou usuário-sistema) — decidir na implementação; opcionalmente só logar em `custos_cliente_mensal` de uma conta "demo" para ser visível no admin.

### 4. UI
- `src/routes/_authenticated/app.admin.uso.tsx` e `app.admin.financeiro.tsx`: adicionar coluna/breakdown "por origem" lendo `eventos_ia` (chat vs importação vs embeddings vs demo).
- `src/routes/_authenticated/app.conta.tsx` (ou onde o próprio usuário vê seu uso): mostrar "Créditos usados este mês" separando **Chat** vs **Processamento de documentos** vs **Importação de convenção**, para o usuário entender de onde vem o consumo.

### 5. Backfill leve (opcional)
Não temos histórico de tokens dos consumos passados. Registrar um único evento manual de ajuste (origem `"backfill_estimativa"`) por usuário afetado, baseado no nº de PDFs já processados × custo médio, para o dashboard não parecer "quebrado" retroativamente. Ou deixar sem backfill e comunicar que a partir de agora todo consumo é rastreado.

### Não-objetivos
- Não alterar o limite mensal de mensagens do plano (uso de IA de sistema não deve consumir a cota do usuário).
- Não expor `X-Lovable-AIG-Log-ID` ao browser (fica só no servidor, salvo em `eventos_ia` para auditoria).
- Não mudar o cálculo já existente do chat — ele continua funcionando pela mesma via.

Ao aprovar, executo migração + helpers + instrumentação dos 4 pontos + ajustes de UI, e valido com um SELECT em `eventos_ia` após uma importação de teste.
