import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Preços dos planos (fonte única no servidor).
 * Mantidos em sincronia com src/components/landing/PricingSection.tsx.
 */
const PRICING: Record<
  string,
  { mensal: number | null; anualPorMes: number | null; anualTotal: number | null; nome: string }
> = {
  gratuito: { mensal: null, anualPorMes: null, anualTotal: null, nome: "Gratuito" },
  essencial: { mensal: 89, anualPorMes: 74, anualTotal: 888, nome: "Essencial" },
  profissional: { mensal: 197, anualPorMes: 164, anualTotal: 1968, nome: "Profissional" },
  gestao: { mensal: 347, anualPorMes: 289, anualTotal: 3468, nome: "Gestão" },
  administradora: { mensal: 697, anualPorMes: 580, anualTotal: 6960, nome: "Administradora" },
  personalizado: { mensal: null, anualPorMes: null, anualTotal: null, nome: "Personalizado" },
};

const criarSchema = z.object({
  plano_id: z.enum([
    "essencial",
    "profissional",
    "gestao",
    "administradora",
  ]),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  billing_type: z.enum(["UNDEFINED", "PIX", "BOLETO", "CREDIT_CARD"]).default("UNDEFINED"),
  callback_url: z.string().url().optional(),
});

export const criarAssinaturaAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Perfil do usuário
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("nome, email, cpf_cnpj, telefone, razao_social, tipo_pessoa")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error("Perfil não encontrado.");
    if (!profile.cpf_cnpj || profile.cpf_cnpj.replace(/\D/g, "").length < 11) {
      throw new Error(
        "Informe seu CPF ou CNPJ na página Conta antes de assinar um plano.",
      );
    }
    if (!profile.email) throw new Error("Email não encontrado no perfil.");

    // 2) Preço e ciclo
    const preco = PRICING[data.plano_id];
    if (!preco) throw new Error(`Plano inválido: ${data.plano_id}`);

    let value: number | null;
    let cycle: "MONTHLY" | "YEARLY";
    if (data.ciclo === "anual") {
      value = preco.anualTotal;
      cycle = "YEARLY";
    } else {
      value = preco.mensal;
      cycle = "MONTHLY";
    }
    if (!value || value <= 0) {
      throw new Error(
        `Plano "${preco.nome}" não possui preço público. Fale com a equipe.`,
      );
    }

    // 3) Cliente Asaas (busca por CPF/CNPJ, cria se não existir)
    const asaas = await import("./asaas.server");
    const ambiente = asaas.getAsaasEnv();

    const nomeCliente =
      profile.tipo_pessoa === "pj" && profile.razao_social
        ? profile.razao_social
        : profile.nome || profile.email;

    const customer = await asaas.ensureCustomer({
      name: nomeCliente,
      email: profile.email,
      cpfCnpj: profile.cpf_cnpj,
      mobilePhone: profile.telefone ?? undefined,
      externalReference: userId,
    });

    // 4) Cria assinatura
    // Monta a successUrl 100% no servidor (não confia no cliente).
    // Se o domínio ainda não estiver cadastrado em "Domínios permitidos"
    // no Asaas, a chamada com callback devolve 400 — nesse caso caímos
    // no fallback silencioso sem callback e o fluxo continua funcionando
    // via polling em /app/assinatura/retorno.
    const origin = (() => {
      try {
        const o = getRequestHeader("origin");
        if (o && /^https?:\/\//.test(o)) return o.replace(/\/$/, "");
      } catch {}
      return process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://augustoij.com.br";
    })();
    const successUrl = `${origin}/app/assinatura/retorno`;

    const baseSubInput = {
      customerId: customer.id,
      value,
      cycle,
      billingType: data.billing_type,
      nextDueDate: asaas.tomorrowIsoDate(),
      description: `Assinatura ${preco.nome} — Augusto.IJ (${data.ciclo})`,
      externalReference: `${userId}:${data.plano_id}:${data.ciclo}`,
    };

    let subscription;
    try {
      subscription = await asaas.createSubscription({
        ...baseSubInput,
        callbackUrl: successUrl,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const domainIssue = /dom[ií]nio|domain/i.test(msg);
      if (!domainIssue) throw e;
      console.warn(
        "[asaas] callback rejeitado (domínio não cadastrado). Repetindo sem callback.",
      );
      subscription = await asaas.createSubscription(baseSubInput);
    }

    // 5) Primeira cobrança (para pegar invoiceUrl)
    const firstPayment = await asaas.getFirstPaymentOfSubscription(subscription.id);
    const paymentUrl =
      firstPayment?.invoiceUrl ??
      firstPayment?.bankSlipUrl ??
      null;

    // 6) Persiste no Supabase (não altera plano ativo — só marca como pendente)
    const { error: upsertErr } = await supabase
      .from("subscriptions")
      .update({
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        asaas_payment_url: paymentUrl,
        asaas_billing_type: data.billing_type,
        asaas_ciclo: data.ciclo,
        asaas_status: subscription.status,
        asaas_ambiente: ambiente,
        pending_plano_config_id: data.plano_id,
        pending_desde: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (upsertErr) {
      // Caso não exista linha ainda, cria uma preservando plano gratuito.
      const { error: insertErr } = await supabase.from("subscriptions").insert({
        user_id: userId,
        plano_config_id: "gratuito",
        status: "trialing",
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        asaas_payment_url: paymentUrl,
        asaas_billing_type: data.billing_type,
        asaas_ciclo: data.ciclo,
        asaas_status: subscription.status,
        asaas_ambiente: ambiente,
        pending_plano_config_id: data.plano_id,
        pending_desde: new Date().toISOString(),
      });
      if (insertErr) throw new Error(insertErr.message);
    }

    return {
      subscription_id: subscription.id,
      customer_id: customer.id,
      payment_url: paymentUrl,
      status: subscription.status,
      value,
      cycle,
      plano_id: data.plano_id,
      ciclo: data.ciclo,
    };
  });

export const getAssinaturaPendente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "plano_config_id, asaas_subscription_id, asaas_payment_url, asaas_status, asaas_ciclo, pending_plano_config_id, pending_desde",
      )
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  });

/**
 * Perfil resumido para exibir na página de assinatura, confirmando ao usuário
 * que a assinatura será vinculada à conta atual.
 */
export const getPerfilParaAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("nome, email, cpf_cnpj, telefone, tipo_pessoa, razao_social")
      .eq("id", userId)
      .maybeSingle();
    return data;
  });

/**
 * Status atual da assinatura + se o usuário já possui algum condomínio.
 * Usado pela tela de retorno pós-pagamento (`/app/assinatura/retorno`) para
 * fazer polling até o webhook do Asaas promover `plano_config_id`.
 */
export const getStatusAssinaturaAtual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plano_config_id, status, pending_plano_config_id, asaas_status")
      .eq("user_id", userId)
      .maybeSingle();
    const { count } = await supabase
      .from("condominios")
      .select("id", { head: true, count: "exact" })
      .eq("owner_id", userId);
    return {
      plano_config_id: sub?.plano_config_id ?? null,
      status: sub?.status ?? null,
      pending_plano_config_id: sub?.pending_plano_config_id ?? null,
      asaas_status: sub?.asaas_status ?? null,
      tem_condominio: (count ?? 0) > 0,
    };
  });

/**
 * Detalhes de pagamento da assinatura ativa (valor, próxima renovação, forma).
 * Consulta Asaas em tempo real quando há `asaas_subscription_id`.
 */
export const getAssinaturaDetalhes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select(
        "plano_config_id, status, asaas_subscription_id, asaas_status, asaas_ciclo, asaas_billing_type, asaas_payment_url, cancelado_em, cancelamento_motivo, overdue_desde",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub) return null;

    let asaasInfo: {
      value: number | null;
      nextDueDate: string | null;
      status: string | null;
      cycle: string | null;
      billingType: string | null;
      invoiceUrl: string | null;
      deleted: boolean;
    } | null = null;

    if (sub.asaas_subscription_id) {
      try {
        const asaas = await import("./asaas.server");
        const remote = await asaas.getSubscription(sub.asaas_subscription_id);
        const nextPayment = await asaas.getFirstPaymentOfSubscription(
          sub.asaas_subscription_id,
        );
        asaasInfo = {
          value: remote.value ?? null,
          nextDueDate: remote.nextDueDate ?? null,
          status: remote.status ?? null,
          cycle: remote.cycle ?? null,
          billingType: remote.billingType ?? null,
          invoiceUrl:
            nextPayment?.invoiceUrl ?? nextPayment?.bankSlipUrl ?? sub.asaas_payment_url ?? null,
          deleted: remote.deleted === true,
        };
      } catch (e) {
        // Falha ao consultar Asaas não deve quebrar a tela — retorna só o que temos localmente.
        asaasInfo = null;
      }
    }

    return {
      local: sub,
      asaas: asaasInfo,
    };
  });

const cancelarSchema = z.object({
  motivo: z.string().min(1).max(120),
  detalhes: z.string().max(1000).optional().nullable(),
});

/**
 * Cancela a assinatura ativa no Asaas e registra o motivo para acompanhamento
 * no dashboard do administrador. O acesso permanece até o fim do ciclo pago
 * (não rebaixamos o plano imediatamente — só marcamos `cancelado_em`).
 */
export const cancelarAssinaturaAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("asaas_subscription_id, plano_config_id, cancelado_em")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sub?.asaas_subscription_id) {
      throw new Error("Nenhuma assinatura ativa para cancelar.");
    }
    if (sub.cancelado_em) {
      throw new Error("Sua assinatura já está cancelada.");
    }

    const asaas = await import("./asaas.server");
    try {
      await asaas.cancelSubscription(sub.asaas_subscription_id);
    } catch (e) {
      throw new Error(
        `Não foi possível cancelar no gateway: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("subscriptions")
      .update({
        cancelado_em: now,
        cancelamento_motivo: data.motivo,
        asaas_status: "CANCELLED",
      })
      .eq("user_id", userId);

    await supabase.from("cancelamentos").insert({
      user_id: userId,
      plano_config_id: sub.plano_config_id,
      asaas_subscription_id: sub.asaas_subscription_id,
      motivo: data.motivo,
      detalhes: data.detalhes ?? null,
    });

    return { ok: true };
  });