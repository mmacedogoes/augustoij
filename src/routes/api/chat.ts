import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider, embedText } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = {
  messages?: UIMessage[];
  condominioId?: string;
  conversaId?: string;
};

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

          const { messages, condominioId, conversaId } = (await request.json()) as ChatBody;
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
                    (m: { nome_arquivo: string; conteudo: string }, i: number) =>
                      `[Trecho ${i + 1} — ${m.nome_arquivo}]\n${m.conteudo}`,
                  )
                  .join("\n\n---\n\n");
              }
            } catch (e) {
              console.error("RAG retrieval failed:", e);
            }
          }

          const systemPrompt = `Você é o assistente jurídico do CondoIA, especialista em gestão de condomínios brasileiros (Código Civil, Lei 4.591/64, jurisprudência do STJ).

REGRAS:
- Responda em português brasileiro, claro e objetivo.
- Use APENAS o contexto dos documentos do condomínio fornecidos abaixo quando relevante. Cite o trecho referenciando o nome do arquivo entre colchetes.
- Se não houver contexto suficiente, diga isso explicitamente e responda com base na legislação geral.
- Sempre encerre com: "⚠️ Este conteúdo é informativo e não substitui parecer jurídico de advogado(a) inscrito(a) na OAB."

${contexto ? `CONTEXTO DOS DOCUMENTOS DO CONDOMÍNIO:\n\n${contexto}` : "Nenhum documento relevante foi encontrado nos arquivos do condomínio para esta pergunta."}`;

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
            messages: convertToModelMessages(messages),
            onFinish: async ({ text, usage }) => {
              try {
                await supabase.from("mensagens").insert({
                  conversa_id: conversaId,
                  papel: "assistant",
                  conteudo: text,
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