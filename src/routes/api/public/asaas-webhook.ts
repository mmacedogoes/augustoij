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
      customer: z.string().nullish(),
      status: z.string().nullish(),
      value: z.number().nullish(),
      nextDueDate: z.string().nullish(),
      invoiceUrl: z.string().nullish(),
      bankSlipUrl: z.string().nullish(),
    })
    .partial()
    .optional(),
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBRL(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const head = user.slice(0, 2);
  return `${head}***@${domain}`;
}

function buildPagamentoConfirmadoHtml(params: {
  nomePlano: string;
  valor: string;
  proximaData: string;
}): string {
  const nome = escapeHtml(params.nomePlano);
  const valor = escapeHtml(params.valor);
  const proxima = escapeHtml(params.proximaData);
  const URL_LOGO_COMPLETO =
    "https://augustoij.com.br/__l5e/assets-v1/598c4b3d-6b9f-4b5a-a484-6e195d698b48/augusto-ij-logo-full-dark-FINAL.png";
  const link_dashboard = "https://augustoij.com.br/app";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Augusto.IJ</title></head>
<body style="margin:0;padding:0;background-color:#F4F3F2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F3F2" style="background-color:#F4F3F2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;max-width:600px;width:100%;">
  <tr><td align="center" bgcolor="#00512B" style="background-color:#00512B;padding:36px 40px;">
    <img src="${URL_LOGO_COMPLETO}" width="240" alt="Augusto.IJ — Inteligência Jurídica para Condomínios" border="0" style="display:block;margin:0 auto;max-width:240px;height:auto;">
  </td></tr>
  <tr><td style="padding:40px;color:#1F2937;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
      <tr><td bgcolor="#E7EDE9" style="background-color:#E7EDE9;border-radius:20px;padding:7px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#00512B;">PAGAMENTO CONFIRMADO</td></tr>
    </table>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:24px;color:#00512B;margin:0 0 16px;">Seu plano ${nome} está ativo</h1>
    <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 14px;">Recebemos a confirmação do seu pagamento de ${valor}. Todos os recursos do plano ${nome} já estão liberados na sua conta.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;font-size:14px;">
      <tr><td style="padding:9px 0;color:#475569;">Plano</td><td align="right" style="padding:9px 0;font-weight:bold;color:#1F2937;">${nome}</td></tr>
      <tr><td style="padding:9px 0;color:#475569;border-top:1px solid #E4E1D8;">Valor</td><td align="right" style="padding:9px 0;font-weight:bold;color:#1F2937;border-top:1px solid #E4E1D8;">${valor}</td></tr>
      <tr><td style="padding:9px 0;color:#475569;border-top:1px solid #E4E1D8;">Próxima cobrança</td><td align="right" style="padding:9px 0;font-weight:bold;color:#1F2937;border-top:1px solid #E4E1D8;">${proxima}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto;">
      <tr><td align="center" bgcolor="#B8935A" style="background-color:#B8935A;border-radius:4px;">
        <a href="${link_dashboard}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Acessar minha conta</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" bgcolor="#F4F3F2" style="background-color:#F4F3F2;padding:20px 40px;border-top:1px solid #E4E1D8;">
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#475569;margin:0;">Augusto.IJ Tecnologia LTDA — Este é um comprovante de pagamento, guarde para seus registros.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function enviarEmailPagamentoConfirmado(args: {
  supabaseAdmin: any;
  userId: string;
  planoId: string | null;
  valorCentavos: number | undefined;
  proximaData: string | undefined;
}): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[asaas-webhook] RESEND_API_KEY ausente — pulando e-mail");
    return;
  }

  // Busca e-mail do usuário
  const { data: userRes, error: userErr } =
    await args.supabaseAdmin.auth.admin.getUserById(args.userId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    console.error("[asaas-webhook] usuário sem e-mail", userErr);
    return;
  }

  // Busca nome do plano
  let nomePlano = "contratado";
  if (args.planoId) {
    const { data: plano } = await args.supabaseAdmin
      .from("planos")
      .select("nome")
      .eq("id", args.planoId)
      .maybeSingle();
    if (plano?.nome) nomePlano = plano.nome;
  }

  const html = buildPagamentoConfirmadoHtml({
    nomePlano,
    valor: formatBRL(args.valorCentavos ?? null),
    proximaData: formatDataBR(args.proximaData ?? null),
  });

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
      to: [email],
      subject: `Pagamento confirmado — seu plano ${nomePlano} está ativo`,
      html,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    console.error("[asaas-webhook] Resend falhou", resp.status, detail);
  } else {
    console.log("[asaas-webhook] e-mail de confirmação enviado para", maskEmail(email));
  }
}

function buildPagamentoPendenteHtml(params: {
  nomePlano: string;
  valor: string;
  linkPagamento: string;
}): string {
  const nome = escapeHtml(params.nomePlano);
  const valor = escapeHtml(params.valor);
  const link = escapeHtml(params.linkPagamento);
  const URL_LOGO_COMPLETO =
    "https://augustoij.com.br/__l5e/assets-v1/598c4b3d-6b9f-4b5a-a484-6e195d698b48/augusto-ij-logo-full-dark-FINAL.png";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Augusto.IJ</title></head>
<body style="margin:0;padding:0;background-color:#F4F3F2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F3F2" style="background-color:#F4F3F2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;max-width:600px;width:100%;">
  <tr><td align="center" bgcolor="#00512B" style="background-color:#00512B;padding:36px 40px;">
    <img src="${URL_LOGO_COMPLETO}" width="240" alt="Augusto.IJ — Inteligência Jurídica para Condomínios" border="0" style="display:block;margin:0 auto;max-width:240px;height:auto;">
  </td></tr>
  <tr><td style="padding:40px;color:#1F2937;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
      <tr><td bgcolor="#F3EBDC" style="background-color:#F3EBDC;border-radius:20px;padding:7px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#8A6A3F;">PAGAMENTO PENDENTE</td></tr>
    </table>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:24px;color:#00512B;margin:0 0 16px;">Identificamos um pagamento em aberto</h1>
    <p style="font-size:15px;line-height:1.65;color:#1F2937;margin:0 0 14px;">O pagamento do seu plano ${nome}, no valor de ${valor}, ainda não foi confirmado. Você tem alguns dias antes de qualquer alteração no seu acesso.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto;">
      <tr><td align="center" bgcolor="#00512B" style="background-color:#00512B;border-radius:4px;">
        <a href="${link}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Regularizar pagamento</a>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#475569;margin:0;">Se você já pagou, pode ignorar este e-mail — a confirmação pode levar até 1 dia útil para boleto e Pix.</p>
  </td></tr>
  <tr><td align="center" bgcolor="#F4F3F2" style="background-color:#F4F3F2;padding:20px 40px;border-top:1px solid #E4E1D8;">
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#475569;margin:0;">Augusto.IJ Tecnologia LTDA</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function enviarEmailPagamentoPendente(args: {
  supabaseAdmin: any;
  userId: string;
  planoId: string | null;
  valorCentavos: number | undefined;
  linkPagamento: string;
}): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("[asaas-webhook] RESEND_API_KEY ausente — pulando e-mail");
    return;
  }

  const { data: userRes, error: userErr } =
    await args.supabaseAdmin.auth.admin.getUserById(args.userId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    console.error("[asaas-webhook] usuário sem e-mail", userErr);
    return;
  }

  let nomePlano = "contratado";
  if (args.planoId) {
    const { data: plano } = await args.supabaseAdmin
      .from("planos")
      .select("nome")
      .eq("id", args.planoId)
      .maybeSingle();
    if (plano?.nome) nomePlano = plano.nome;
  }

  const html = buildPagamentoPendenteHtml({
    nomePlano,
    valor: formatBRL(args.valorCentavos ?? null),
    linkPagamento: args.linkPagamento,
  });

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Augusto.IJ <naoresponda@mail.augustoij.com.br>",
      to: [email],
      subject: "Aviso: seu pagamento está pendente",
      html,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    console.error("[asaas-webhook] Resend (overdue) falhou", resp.status, detail);
  } else {
    console.log("[asaas-webhook] e-mail de pagamento pendente enviado para", maskEmail(email));
  }
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Regra do Asaas: sempre responder 200. Qualquer falha de
        // processamento é registrada em log; não relançamos para o Asaas.
        try {
          const bodyText = await request.text();

          // Validação obrigatória do token compartilhado. Sem o segredo
          // configurado, o endpoint rejeita qualquer chamada — evita que
          // um atacante forje eventos de pagamento.
          const expected = process.env.ASAAS_WEBHOOK_TOKEN;
          if (!expected) {
            console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN ausente");
            return new Response("Unauthorized", { status: 401 });
          }
          const provided = request.headers.get("asaas-access-token") ?? "";
          if (provided !== expected) {
            console.warn("[asaas-webhook] token inválido");
            return new Response("Unauthorized", { status: 401 });
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
                  // Envia e-mail de confirmação de pagamento (não bloqueia o webhook)
                  try {
                    await enviarEmailPagamentoConfirmado({
                      supabaseAdmin,
                      userId: sub.user_id,
                      planoId: novoPlano,
                      valorCentavos: parsed.payment?.value ?? undefined,
                      proximaData: parsed.payment?.nextDueDate ?? undefined,
                    });
                  } catch (mailErr) {
                    console.error("[asaas-webhook] falha ao enviar e-mail", mailErr);
                  }
                }
              } else if (event === "PAYMENT_OVERDUE") {
                const { data: updatedRows, error: upErr } = await supabaseAdmin
                  .from("subscriptions")
                  .update({
                    overdue_desde: new Date().toISOString(),
                    asaas_status: parsed.payment?.status ?? "OVERDUE",
                  })
                  .eq("id", sub.id)
                  .is("overdue_desde", null)
                  .select("id");
                if (upErr) {
                  console.error("[asaas-webhook] erro ao marcar overdue", upErr);
                } else {
                  console.log(
                    `[asaas-webhook] overdue registrado user=${sub.user_id} (tolerância 2 dias)`,
                  );
                }
                // Envia e-mail de aviso apenas na primeira marcação, para não
                // repetir a cada webhook. Se já estava overdue, o update acima
                // não afeta nenhuma linha.
                if (!upErr && Array.isArray(updatedRows) && updatedRows.length > 0) {
                  const linkPagamento =
                    parsed.payment?.invoiceUrl ||
                    parsed.payment?.bankSlipUrl ||
                    "https://augustoij.com.br/app/assinatura";
                  try {
                    await enviarEmailPagamentoPendente({
                      supabaseAdmin,
                      userId: sub.user_id,
                      planoId: sub.plano_config_id ?? sub.pending_plano_config_id ?? null,
                      valorCentavos: parsed.payment?.value ?? undefined,
                      linkPagamento,
                    });
                  } catch (mailErr) {
                    console.error(
                      "[asaas-webhook] falha ao enviar e-mail (overdue)",
                      mailErr,
                    );
                  }
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