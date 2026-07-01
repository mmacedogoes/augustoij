import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  question: z.string().trim().min(3).max(500),
});

const MAX_QUESTIONS = 3;

function getIp(request: Request): string {
  const h = request.headers;
  const raw =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";
  return raw || "0.0.0.0";
}

export const Route = createFileRoute("/api/public/demo-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof Body>;
        try {
          payload = Body.parse(await request.json());
        } catch {
          return Response.json(
            { error: "Pergunta inválida. Envie entre 3 e 500 caracteres." },
            { status: 400 },
          );
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return Response.json(
            { error: "Serviço indisponível no momento." },
            { status: 500 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ip = getIp(request);

        const { data: usage } = await supabaseAdmin
          .from("demo_chat_usage" as never)
          .select("count")
          .eq("ip", ip)
          .maybeSingle<{ count: number }>();

        const currentCount = usage?.count ?? 0;
        if (currentCount >= MAX_QUESTIONS) {
          return Response.json(
            {
              error:
                "Você já usou suas 3 perguntas gratuitas. Crie uma conta para continuar conversando com Augusto.",
              limitReached: true,
              remaining: 0,
            },
            { status: 429 },
          );
        }

        // Call Lovable AI Gateway (non-streaming, keep it simple)
        let answer: string;
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": lovableKey,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "Você é Augusto, uma inteligência jurídica especializada em direito condominial brasileiro. " +
                    "Responda em português, de forma clara, fundamentada e concisa (máx. 5 parágrafos curtos). " +
                    "Cite dispositivos legais (Código Civil, Lei 4.591/64, jurisprudência do STJ) sempre que fizer sentido. " +
                    "Se a pergunta fugir do escopo condominial, oriente educadamente. " +
                    "Esta é uma demonstração pública: mantenha a resposta útil e enxuta.",
                },
                { role: "user", content: payload.question },
              ],
            }),
          });

          if (res.status === 429) {
            return Response.json(
              { error: "Limite temporário atingido. Tente novamente em instantes." },
              { status: 429 },
            );
          }
          if (res.status === 402) {
            return Response.json(
              { error: "Créditos esgotados no momento. Tente novamente mais tarde." },
              { status: 402 },
            );
          }
          if (!res.ok) {
            const txt = await res.text();
            console.error("[demo-chat] gateway error", res.status, txt);
            return Response.json(
              { error: "Não foi possível gerar a resposta agora." },
              { status: 502 },
            );
          }

          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          answer = json.choices?.[0]?.message?.content?.trim() ?? "";
          if (!answer) {
            return Response.json(
              { error: "Resposta vazia. Tente reformular a pergunta." },
              { status: 502 },
            );
          }
        } catch (err) {
          console.error("[demo-chat] fetch failed", err);
          return Response.json(
            { error: "Falha de rede ao consultar Augusto." },
            { status: 502 },
          );
        }

        // Increment usage (upsert)
        const nextCount = currentCount + 1;
        await supabaseAdmin
          .from("demo_chat_usage" as never)
          .upsert(
            { ip, count: nextCount, last_at: new Date().toISOString() },
            { onConflict: "ip" },
          );

        return Response.json({
          answer,
          remaining: MAX_QUESTIONS - nextCount,
        });
      },
    },
  },
});
