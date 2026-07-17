import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook Asaas — recebimento de eventos de cobrança.
 *
 *  - valida o header `asaas-access-token` (segredo compartilhado, opcional);
 *  - registra o evento em `asaas_webhook_events` (idempotente por id);
 *  - PAYMENT_CONFIRMED / PAYMENT_RECEIVED → libera o plano contratado
 *    (promove `pending_plano_config_id` para `plano_config_id`);
 *  - PAYMENT_OVERDUE → marca `overdue_desde` (tolerância de 2 dias);
 *  - responde sempre 200 para o Asaas não reagendar.
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
        // Regra do Asaas: sempre responder 200. Qualquer falha de
        // processamento é registrada em log; não relançamos para o Asaas.
        try {
          const bodyText = await request.text();

          // Validação do token compartilhado (opcional). Se o segredo
          // estiver definido no ambiente, exige match exato.
          const expected = process.env.ASAAS_WEBHOOK_TOKEN;
          if (expected) {
            const provided = request.headers.get("asaas-access-token") ?? "";
            if (provided !== expected) {
              console.warn("[asaas-webhook] token inválido");
              return Response.json({ ok: true, ignored: "auth" });
            }
          }

          let parsed: z.infer<typeof payloadSchema>;
          try {
            parsed = payloadSchema.parse(JSON.parse(bodyText));
          } catch (err) {
            console.error("[asaas-webhook] payload inválido", err);
            return Response.json({ ok: true, ignored: "payload" });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const subscriptionId = parsed.payment?.subscription ?? null;
          const event = parsed.event;

          // 1) log idempotente do evento
          await supabaseAdmin
            .from("asaas_webhook_events")
            .upsert(
              {
                event_id: parsed.id ?? null,
                event_type: event,
                payment_id: parsed.payment?.id ?? null,
                subscription_id: subscriptionId,
                customer_id: parsed.payment?.customer ?? null,
                status: parsed.payment?.status ?? null,
                payload: JSON.parse(bodyText),
              },
              { onConflict: "event_id", ignoreDuplicates: true },
            );

          // 2) trata efeitos colaterais por tipo de evento
          if (subscriptionId) {
            const { data: sub, error: subErr } = await supabaseAdmin
              .from("subscriptions")
              .select(
                "id, user_id, plano_config_id, pending_plano_config_id, asaas_subscription_id",
              )
              .eq("asaas_subscription_id", subscriptionId)
              .maybeSingle();

            if (subErr) {
              console.error("[asaas-webhook] erro ao buscar assinatura", subErr);
            } else if (!sub) {
              console.warn(
                "[asaas-webhook] assinatura não encontrada para",
                subscriptionId,
              );
            } else {
              if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
                const novoPlano = sub.pending_plano_config_id ?? sub.plano_config_id;
                const { error: upErr } = await supabaseAdmin
                  .from("subscriptions")
                  .update({
                    plano_config_id: novoPlano,
                    pending_plano_config_id: null,
                    pending_desde: null,
                    overdue_desde: null,
                    suspenso_em: null,
                    status: "active",
                    asaas_status: parsed.payment?.status ?? "CONFIRMED",
                  })
                  .eq("id", sub.id);
                if (upErr) {
                  console.error("[asaas-webhook] erro ao liberar plano", upErr);
                } else {
                  console.log(
                    `[asaas-webhook] plano liberado user=${sub.user_id} plano=${novoPlano}`,
                  );
                }
              } else if (event === "PAYMENT_OVERDUE") {
                const { error: upErr } = await supabaseAdmin
                  .from("subscriptions")
                  .update({
                    overdue_desde: new Date().toISOString(),
                    asaas_status: parsed.payment?.status ?? "OVERDUE",
                  })
                  .eq("id", sub.id)
                  .is("overdue_desde", null);
                if (upErr) {
                  console.error("[asaas-webhook] erro ao marcar overdue", upErr);
                } else {
                  console.log(
                    `[asaas-webhook] overdue registrado user=${sub.user_id} (tolerância 2 dias)`,
                  );
                }
              }
            }
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[asaas-webhook] falha inesperada", err);
          // Sempre 200 para o Asaas não reagendar indefinidamente.
          return Response.json({ ok: true, error: "internal" });
        }
      },
    },
  },
});