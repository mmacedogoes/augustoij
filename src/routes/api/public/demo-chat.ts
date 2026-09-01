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

        // Incremento atômico do limite por IP (evita corrida entre requisições).
        const { data: usoRows, error: usoErr } = await supabaseAdmin.rpc(
          "incrementar_demo_usage",
          { p_ip: ip, p_max: MAX_QUESTIONS },
        );
        if (usoErr) {
          console.error("[demo-chat] incrementar_demo_usage", usoErr);
          return Response.json({ error: "Serviço indisponível no momento." }, { status: 500 });
        }
        const uso = Array.isArray(usoRows) ? usoRows[0] : usoRows;
        const restante = uso?.restante ?? 0;
        if (uso?.bloqueado) {
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
                    "Responda em português, de forma clara, fundamentada e concisa (máx. 5 parágrafos curtos ou uma lista objetiva). " +
                    "Cite dispositivos legais (Código Civil, Lei 4.591/64, CLT quando couber, jurisprudência do STJ) sempre que fizer sentido. " +
                    "ESCOPO: além de temas clássicos de direito condominial (convenção, regimento, assembleias, cotas, uso de áreas comuns, responsabilidade do síndico, sanções), TAMBÉM estão dentro do seu escopo os contratos de prestação de serviços firmados por condomínios — portaria, segurança, controle de acesso, limpeza e conservação, jardinagem, administradora, elevadores, obras e reformas, dedetização, contabilidade, manutenção predial e similares. Nunca recuse esses temas como se fossem 'fora do escopo condominial'. " +
                    "PEDIDOS DE ANÁLISE DE CONTRATO SEM ANEXO: nesta demonstração pública o usuário NÃO consegue anexar documentos. Quando ele pedir análise, revisão ou parecer sobre um contrato (ex.: portaria, limpeza, administradora), NÃO recuse e NÃO diga que precisa do documento para opinar. Em vez disso, entregue um checklist estruturado dos pontos críticos de revisão daquele tipo específico de contrato, cobrindo quando aplicável: (1) objeto e escopo do serviço e SLA, (2) prazo, vigência e renovação, (3) preço, reajuste e reequilíbrio, (4) obrigações trabalhistas, previdenciárias e responsabilidade solidária/subsidiária do condomínio (Súmula 331 do TST), (5) seguro de responsabilidade civil e cobertura de danos, (6) rescisão, multa e aviso prévio, (7) subcontratação e substituição de pessoal, (8) LGPD e tratamento de dados (câmeras, visitantes, moradores), (9) foro e resolução de conflitos, (10) cláusulas específicas do tipo de serviço pedido. Adapte o checklist ao contrato citado pelo usuário. " +
                    "Feche informando, em uma única linha, que a análise completa do documento (semáforo por cláusula, sugestões de redação e fundamentação) fica disponível ao criar conta e anexar o contrato na aba Documentos. " +
                    "Se a pergunta realmente não tiver nenhuma relação com condomínios (ex.: divórcio, direito penal), aí sim oriente educadamente a procurar um especialista. " +
                    "Esta é uma demonstração pública: mantenha a resposta útil, prática e enxuta.",
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

          const aigLogId = res.headers.get("x-lovable-aig-log-id");
          const aigRunId = res.headers.get("x-lovable-aig-run-id");
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          answer = json.choices?.[0]?.message?.content?.trim() ?? "";
          if (!answer) {
            return Response.json(
              { error: "Resposta vazia. Tente reformular a pergunta." },
              { status: 502 },
            );
          }
          try {
            const { registrarEventoIa } = await import("@/lib/uso-ia.server");
            await registrarEventoIa({
              userId: null,
              origem: "demo_chat",
              model: "google/gemini-2.5-flash",
              tokensInput: json.usage?.prompt_tokens ?? 0,
              tokensOutput: json.usage?.completion_tokens ?? 0,
              aigLogId,
              aigRunId,
              meta: { ip },
            });
          } catch (err) {
            console.error("[uso-ia] demo_chat:", err);
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
        await db
          .from("demo_chat_usage")
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
