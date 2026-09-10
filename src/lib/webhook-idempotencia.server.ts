import { createHash } from "crypto";

export interface AsaasWebhookPayload {
  id?: string;
  event: string;
  payment?: {
    id?: string;
    subscription?: string | null;
    customer?: string | null;
    status?: string | null;
    value?: number | null;
    nextDueDate?: string | null;
    invoiceUrl?: string | null;
    bankSlipUrl?: string | null;
  } | null;
  [key: string]: any;
}

export interface WebhookProcessingResult<T = any> {
  status: "processed" | "duplicate" | "error";
  eventId: string;
  result?: T;
  error?: string;
}

/**
 * Gera uma chave determinística e única para o evento de webhook do Asaas.
 * Prioriza o event ID nativo do Asaas (`id`), com fallback composto de pagamento e hash seguro.
 */
export function gerarChaveIdempotenteAsaas(payload: AsaasWebhookPayload): string {
  if (payload.id && typeof payload.id === "string" && payload.id.trim()) {
    return payload.id.trim();
  }

  const event = payload.event || "UNKNOWN_EVENT";
  const paymentId = payload.payment?.id || "NO_PAYMENT";
  const status = payload.payment?.status || "NO_STATUS";
  const date = payload.payment?.nextDueDate || "";
  const val = payload.payment?.value != null ? String(payload.payment.value) : "";

  const seed = `${event}:${paymentId}:${status}:${date}:${val}`;
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 24);

  return `evt_${event}_${paymentId}_${hash}`;
}

/**
 * Orquestrador de idempotência estrita para Webhooks do Asaas.
 * Garante que cada evento seja executado uma única vez, prevenindo duplicidade
 * de liberações de planos, repetições de e-mails do Resend e condições de corrida.
 */
export async function processarWebhookAsaasIdempotente<T>(params: {
  supabaseAdmin: any;
  payload: AsaasWebhookPayload;
  rawBodyText?: string;
  handler: (eventId: string) => Promise<T>;
}): Promise<WebhookProcessingResult<T>> {
  const { supabaseAdmin, payload, rawBodyText, handler } = params;
  const eventId = gerarChaveIdempotenteAsaas(payload);
  const subscriptionId = payload.payment?.subscription ?? null;

  try {
    // 1. Consulta se o evento já existe e já foi processado
    const { data: existingEvent, error: findErr } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("id, event_id, processado_em, erro")
      .eq("event_id", eventId)
      .maybeSingle();

    if (findErr) {
      console.warn("[webhook-idempotencia] Aviso ao consultar evento existente:", findErr.message);
    }

    if (existingEvent && existingEvent.processado_em) {
      console.log(
        `[webhook-idempotencia] Evento ${eventId} (${payload.event}) ja foi processado com sucesso em ${existingEvent.processado_em}. Ignorando duplicacao.`,
      );
      return {
        status: "duplicate",
        eventId,
      };
    }

    // 2. Registra ou atualiza o evento como pendente
    const payloadJson = rawBodyText ? JSON.parse(rawBodyText) : payload;
    const { error: upsertErr } = await supabaseAdmin
      .from("asaas_webhook_events")
      .upsert(
        {
          event_id: eventId,
          event_type: payload.event,
          payment_id: payload.payment?.id ?? null,
          subscription_id: subscriptionId,
          customer_id: payload.payment?.customer ?? null,
          status: payload.payment?.status ?? null,
          payload: payloadJson,
        },
        { onConflict: "event_id", ignoreDuplicates: false },
      );

    if (upsertErr) {
      console.error("[webhook-idempotencia] Erro ao registrar asaas_webhook_events:", upsertErr);
    }

    // 3. Executa a lógica de negócio (side-effects)
    const result = await handler(eventId);

    // 4. Marca o evento como processado com sucesso
    await supabaseAdmin
      .from("asaas_webhook_events")
      .update({
        processado_em: new Date().toISOString(),
        erro: null,
      })
      .eq("event_id", eventId);

    console.log(`[webhook-idempotencia] Evento ${eventId} processado e concluido com sucesso.`);

    return {
      status: "processed",
      eventId,
      result,
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook-idempotencia] Falha ao processar evento ${eventId}:`, err);

    // Registra erro para auditoria super-admin
    try {
      await supabaseAdmin
        .from("asaas_webhook_events")
        .update({
          erro: errorMsg,
        })
        .eq("event_id", eventId);
    } catch (dbErr) {
      console.error("[webhook-idempotencia] Falha ao persistir erro do webhook:", dbErr);
    }

    return {
      status: "error",
      eventId,
      error: errorMsg,
    };
  }
}
