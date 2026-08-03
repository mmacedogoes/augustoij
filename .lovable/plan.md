# Nomes e CPF dos condôminos nas notificações

## O que está acontecendo

Verifiquei o endpoint do chat (`src/routes/api/chat.ts`): o contexto enviado à IA é montado só com trechos dos documentos do condomínio, base jurídica curada e anexos. O cadastro de unidades e condôminos (tabelas `unidades` e `condominos`), embora preenchido pelo usuário, **nunca é enviado à IA** — não há nenhuma referência a essas tabelas no handler.

Sem esses dados, o modelo não tem nome nem CPF para usar e justifica a ausência com um argumento genérico de LGPD. Também não existe hoje nenhuma regra no prompt autorizando o uso de dados pessoais em peças dirigidas ao condômino, então prevalece a recusa padrão do modelo.

## Correção

1. **Enviar o cadastro do condomínio para a IA**
   - No handler do chat, quando houver condomínio selecionado, buscar as unidades com seus condôminos (nome, CPF, tipo, titular principal, bloco/número da unidade) usando o cliente autenticado, respeitando a RLS existente.
   - Injetar um bloco novo no prompt: "CADASTRO DE UNIDADES E CONDÔMINOS DESTE CONDOMÍNIO", com uma linha por unidade e seus titulares.
   - Controlar o volume: em condomínios grandes, priorizar as unidades citadas na mensagem do usuário (número/bloco) e truncar o restante, para não estourar contexto nem custo.

2. **Autorizar expressamente o uso dos dados na redação**
   - Acrescentar às "REGRAS DE REDAÇÃO DE PEÇAS DIRIGIDAS AO CONDÔMINO" que notificações, advertências, multas e demais documentos endereçados a condôminos **devem** qualificar o destinatário com nome completo, CPF e unidade quando esses dados constarem do cadastro.
   - Deixar explícito que o tratamento é lícito (cumprimento de obrigação legal e exercício regular de direito na gestão condominial) e que é **proibido** recusar, anonimizar ou usar placeholders alegando LGPD.
   - Se o dado realmente não constar do cadastro, a IA solicita o dado (inclusive pela pergunta estruturada já existente) — nunca inventa CPF.

3. **Preservar o resto**
   - Nenhuma mudança em limites de plano, streaming, persistência de mensagens ou nas regras sobre jurisprudência.
   - Dados pessoais continuam restritos ao condomínio do próprio usuário, com a mesma RLS.

## Detalhes técnicos

- Arquivo principal: `src/routes/api/chat.ts` (montagem do `systemPrompt`).
- Consulta: `unidades` com `condominos(*)` filtrado por `condominio_id`, com o cliente Supabase autenticado já disponível no handler.
- Formatação e truncamento do bloco em um helper puro novo junto de `src/lib/chat-base-condominial.ts`, permitindo teste unitário.