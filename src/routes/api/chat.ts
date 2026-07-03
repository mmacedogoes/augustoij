import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import { createLovableAiGatewayProvider, embedText } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = {
  messages?: UIMessage[];
  condominioId?: string;
  conversaId?: string;
  attachmentContext?: string;
  attachmentNome?: string;
};

function sanitizarResposta(texto: string): string {
  return texto
    // Remove marcadores técnicos entre colchetes
    .replace(/\[(KB|DOC|CHUNK|DOCUMENTO|BASE)\s*\d+(?:\s*[—-][^\]]*)?\]/gi, "")
    .replace(/\[(KB|DOC|CHUNK):\s*[^\]]+\]/gi, "")
    // Remove rótulos descritivos com numeração
    .replace(/(Base jurídica|Documento do condomínio|Trecho|Chunk)\s*#?\s*\d+:?/gi, "")
    // Remove construções "conforme [KB N]" mantendo o conectivo
    .replace(/conforme\s*\[(KB|DOC)\s*\d+\]/gi, "conforme")
    .replace(/de acordo com\s*\[(KB|DOC)\s*\d+\]/gi, "de acordo com")
    .replace(/segundo\s*\[(KB|DOC)\s*\d+\]/gi, "segundo")
    // Limpeza suave preservando quebras de linha
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .trim();
}

function normalizarPergunta(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPergunta(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

/**
 * Emite uma resposta pronta (do cache ou short-circuit) como um
 * UIMessageStream compatível com o cliente do AI SDK.
 */
function respostaEstatica(
  texto: string,
  onFinish?: () => Promise<void> | void,
) {
  const stream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      const id = randomUUID();
      writer.write({ type: "start" } as never);
      writer.write({ type: "text-start", id } as never);
      // Emite em pequenos pedaços para dar sensação de streaming
      const CHUNK = 120;
      for (let i = 0; i < texto.length; i += CHUNK) {
        writer.write({
          type: "text-delta",
          id,
          delta: texto.slice(i, i + CHUNK),
        } as never);
      }
      writer.write({ type: "text-end", id } as never);
      writer.write({ type: "finish" } as never);
    },
    onFinish: async () => {
      if (onFinish) await onFinish();
    },
  });
  return createUIMessageStreamResponse({ stream });
}

// Limpeza leve para chunks de stream — NUNCA toca em quebras de linha
// ou espaços horizontais, para preservar a estrutura markdown
// (cabeçalhos "## ", listas, parágrafos) durante a renderização incremental.
function sanitizarChunk(texto: string): string {
  return texto
    .replace(/\[(KB|DOC|CHUNK|DOCUMENTO|BASE)\s*\d+(?:\s*[—-][^\]]*)?\]/gi, "")
    .replace(/\[(KB|DOC|CHUNK):\s*[^\]]+\]/gi, "")
    .replace(/(Base jurídica|Documento do condomínio|Trecho|Chunk)\s*#?\s*\d+:?/gi, "")
    .replace(/conforme\s*\[(KB|DOC)\s*\d+\]/gi, "conforme")
    .replace(/de acordo com\s*\[(KB|DOC)\s*\d+\]/gi, "de acordo com")
    .replace(/segundo\s*\[(KB|DOC)\s*\d+\]/gi, "segundo");
}

function sanitizarRespostaStream() {
  return () =>
    new TransformStream({
      transform(chunk: unknown, controller) {
        const c = chunk as { type?: string; text?: string };
        if (c && c.type === "text-delta" && typeof c.text === "string") {
          // IMPORTANTE: usar sanitização leve em deltas — collapse de
          // whitespace ou trim por linha corrompe ## / ** quando o
          // delta cai no meio de um token markdown.
          controller.enqueue({ ...(chunk as object), text: sanitizarChunk(c.text) });
        } else {
          controller.enqueue(chunk);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          const supaUrl = process.env.SUPABASE_URL;
          const supaKey = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!apiKey || !supaUrl || !supaKey) {
            return new Response("Configuração de servidor ausente", { status: 500 });
          }

          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) return new Response("Não autenticado", { status: 401 });

          const { messages, condominioId, conversaId, attachmentContext, attachmentNome } =
            (await request.json()) as ChatBody;
          if (!messages?.length || !condominioId || !conversaId) {
            return new Response("Parâmetros inválidos", { status: 400 });
          }

          const supabase = createClient<Database>(supaUrl, supaKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // Verify conversa belongs to caller and condo
          const { data: conv } = await supabase
            .from("conversas")
            .select("id, user_id, condominio_id")
            .eq("id", conversaId)
            .maybeSingle();
          if (!conv || conv.condominio_id !== condominioId) {
            return new Response("Conversa inválida", { status: 403 });
          }

          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const userText =
            lastUser?.parts
              ?.map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim() ?? "";

          // RAG retrieval
          let contexto = "";
          let contextoKb = "";
          if (userText) {
            try {
              const queryEmbedding = await embedText(apiKey, userText);
              const { data: matches } = await supabase.rpc("match_document_chunks", {
                _condominio_id: condominioId,
                _query_embedding: `[${queryEmbedding.join(",")}]` as unknown as string,
                _match_count: 6,
                _min_similarity: 0.3,
              });
              if (matches && Array.isArray(matches) && matches.length > 0) {
                contexto = matches
                  .map(
                    (m: { nome_arquivo: string; conteudo: string }) => {
                      const cabecalho = `(trecho de documento do condomínio${m.nome_arquivo ? `: ${m.nome_arquivo}` : ""})`;
                      return `${cabecalho}\n${m.conteudo}`.trim();
                    },
                  )
                  .join("\n\n---\n\n");
              }

              // Base de conhecimento global (treinada pelo admin)
              const { data: kb } = await supabase.rpc("match_kb_chunks", {
                _query_embedding: `[${queryEmbedding.join(",")}]` as unknown as string,
                _match_count: 4,
                _min_similarity: 0.3,
              });
              if (kb && Array.isArray(kb) && kb.length > 0) {
                contextoKb = kb
                  .map(
                    (
                      m: { titulo: string; tipo: string; fonte: string | null; conteudo: string },
                    ) => {
                      const meta: string[] = [];
                      if (m.titulo) meta.push(m.titulo);
                      if (m.tipo) meta.push(`tipo: ${m.tipo}`);
                      if (m.fonte) meta.push(`fonte: ${m.fonte}`);
                      const cabecalho = meta.length > 0 ? `(${meta.join(" — ")})` : "";
                      return `${cabecalho}\n${m.conteudo}`.trim();
                    },
                  )
                  .join("\n\n---\n\n");
              }
            } catch (e) {
              console.error("RAG retrieval failed:", e);
            }
          }

          // Orientações globais do administrador
          let orientacoesBlock = "";
          try {
            const { data: orientacoes } = await supabase
              .from("ai_orientacoes")
              .select("titulo, conteudo")
              .eq("ativo", true)
              .order("ordem", { ascending: true });
            if (orientacoes && orientacoes.length > 0) {
              orientacoesBlock = orientacoes
                .map((o) => `• ${o.titulo}: ${o.conteudo}`)
                .join("\n");
            }
          } catch (e) {
            console.error("Orientações fetch failed:", e);
          }

          const systemPrompt = `Você é o assistente jurídico do Augusto.IJ, especialista em gestão de condomínios brasileiros (Código Civil, Lei 4.591/64, jurisprudência do STJ).

PROIBIÇÃO TÉCNICA ABSOLUTA — JAMAIS divulgar mecânica interna:
- Você está recebendo abaixo trechos de documentos e jurisprudência que foram recuperados automaticamente para te ajudar a responder.
- JAMAIS mencione, sob qualquer forma, a existência desses trechos como entidades separadas.
- JAMAIS use rótulos como [KB N], [DOC N], "documento 1", "trecho 2", "chunk", "base de dados", "knowledge base", "embedding", "RAG", "vetor" ou variações.
- JAMAIS escreva "conforme o documento X" ou "segundo a base Y" referindo-se a esses trechos internos.
- SEMPRE cite as fontes JURÍDICAS REAIS (artigos de lei, súmulas, jurisprudência publicada com seus dados de identificação completos), NUNCA o lugar de onde a informação foi recuperada internamente.
- As informações dos trechos devem ser apresentadas como CONHECIMENTO INTEGRADO seu, do agente.

REGRAS DE FORMATAÇÃO DAS RESPOSTAS (OBRIGATÓRIAS):
Suas respostas DEVEM usar Markdown com diagramação clara.
1. PARÁGRAFOS: separe ideias em parágrafos curtos (3-5 linhas), com LINHA EM BRANCO entre eles.
2. TÍTULOS DE SEÇÃO: use ## ou ### com emoji funcional quando houver mais de uma seção. Exemplos: "## 📌 Resposta direta", "## 📚 Fundamento", "## 💡 Recomendação prática", "## ⚠️ Alertas".
3. LISTAS: use bullets ("-") para enumerações; cada item em sua própria linha.
4. CITAÇÕES DE LEI/JURISPRUDÊNCIA: destaque com **negrito** ou *itálico*. Ex.: **Art. 1.336, §1º do Código Civil**; *STJ, REsp 1.234.567/SP*.
5. TRECHOS LITERAIS da convenção/ata: use blockquote com ">".
6. ÊNFASES: **negrito** para termos-chave, prazos e valores; *itálico* para nomes de leis ou termos técnicos.
7. NUNCA escreva um único parágrafo gigante. Quebre em blocos visuais com hierarquia.
8. DISCLAIMER FINAL em itálico, separado por linha em branco do conteúdo:
   *⚠️ Conteúdo informativo gerado por inteligência artificial que não substitui o parecer e análise de um advogado habilitado. Seus documentos e informações são processados conforme LGPD.*

REGRAS:
- Responda em português brasileiro, claro e objetivo.
- Priorize o contexto dos documentos do condomínio quando aplicável, integrando a informação naturalmente à resposta (sem citar rótulos internos).
- Fundamente com jurisprudência, doutrina e legislação, citando apenas as fontes jurídicas reais (artigo, súmula, acórdão).
- Se não houver contexto suficiente, diga isso explicitamente e responda com base na legislação geral.

PERGUNTAS ESTRUTURADAS (opcional):
- Quando a pergunta do usuário for ambígua e existirem 2 a 5 caminhos plausíveis para refinar a resposta, você PODE finalizar com um bloco fenced no formato exato abaixo, em uma linha separada após o disclaimer:
\`\`\`pergunta-estruturada
{"pergunta": "Texto curto da escolha", "opcoes": ["Opção 1", "Opção 2", "Opção 3"]}
\`\`\`
- Use no máximo 4 opções, cada uma com até 60 caracteres. Não use este bloco se a pergunta já estiver clara.

${orientacoesBlock ? `ORIENTAÇÕES DA ADMINISTRAÇÃO:\n${orientacoesBlock}\n\n` : ""}${
            contexto
              ? `CONTEXTO DOS DOCUMENTOS DO CONDOMÍNIO:\n\n${contexto}\n\n`
              : "Nenhum documento relevante foi encontrado nos arquivos do condomínio para esta pergunta.\n\n"
          }${contextoKb ? `BASE DE CONHECIMENTO JURÍDICO (curada):\n\n${contextoKb}\n\n` : ""}${
            attachmentContext && attachmentContext.trim()
              ? `DOCUMENTO ANEXADO PELO USUÁRIO NESTA CONVERSA (uso temporário${
                  attachmentNome ? `, arquivo: ${attachmentNome}` : ""
                }):\n\n${attachmentContext}\n\nUtilize este documento como contexto principal quando a pergunta do usuário se referir a ele.`
              : ""
          }`;

          // Persist user message
          await supabase.from("mensagens").insert({
            conversa_id: conversaId,
            papel: "user",
            conteudo: userText,
          });

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            experimental_transform: [sanitizarRespostaStream()],
            onFinish: async ({ text, usage }) => {
              try {
                const textoLimpo = sanitizarResposta(text);
                await supabase.from("mensagens").insert({
                  conversa_id: conversaId,
                  papel: "assistant",
                  conteudo: textoLimpo,
                  model_usado: "google/gemini-3-flash-preview",
                  tokens_usados: usage?.totalTokens ?? null,
                });
                // Set conversa title from first user msg if blank
                const { data: existing } = await supabase
                  .from("conversas")
                  .select("titulo")
                  .eq("id", conversaId)
                  .maybeSingle();
                if (existing && !existing.titulo) {
                  const titulo = userText.slice(0, 60) + (userText.length > 60 ? "…" : "");
                  await supabase.from("conversas").update({ titulo }).eq("id", conversaId);
                }
              } catch (e) {
                console.error("Persist message failed:", e);
              }
            },
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (e) {
          console.error("Chat handler error:", e);
          const msg = e instanceof Error ? e.message : "Erro interno";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});