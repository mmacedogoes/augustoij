import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook Asaas — recebimento de eventos de cobrança.
 *
 * Configuração provisória. A liberação de acesso ao novo plano após
 * a confirmação do pagamento será tratada em uma etapa seguinte,
 * conforme combinado com o usuário. Por enquanto:
 *  - valida o header `asaas-access-token` (segredo compartilhado);
 *  - registra o evento em `asaas_webhook_events` (idempotente por id);
 *  - responde 200 para o Asaas não reagendar.
 */

const payloadSchema = z.object({
  id: z.string().optional(),
  event: z.string(),
  payment: z
    .object({
      id: z.string().optional(),
      subscription: z.string().nullish(),
      customer: z.string().optional(),
      status: z.string().optional(),
    })
    .partial()
    .optional(),
});

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bodyText = await request.text();

        // Validação do token compartilhado (opcional em sandbox — se o
        // segredo estiver definido no ambiente, exige match exato).
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (expected) {
          const provided = request.headers.get("asaas-access-token") ?? "";
          if (provided !== expected) {
            return new Response("invalid token", { status: 401 });
          }
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(bodyText));
        } catch {
          return new Response("invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        await supabaseAdmin
          .from("asaas_webhook_events")
          .upsert(
            {
              event_id: parsed.id ?? null,
              event_type: parsed.event,
              payment_id: parsed.payment?.id ?? null,
              subscription_id: parsed.payment?.subscription ?? null,
              customer_id: parsed.payment?.customer ?? null,
              status: parsed.payment?.status ?? null,
              payload: JSON.parse(bodyText),
            },
            { onConflict: "event_id", ignoreDuplicates: true },
          );

        return Response.json({ ok: true });
      },
    },
  },
});