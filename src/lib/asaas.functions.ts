import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
    const subscription = await asaas.createSubscription({
      customerId: customer.id,
      value,
      cycle,
      billingType: data.billing_type,
      nextDueDate: asaas.tomorrowIsoDate(),
      description: `Assinatura ${preco.nome} — Augusto.IJ (${data.ciclo})`,
      externalReference: `${userId}:${data.plano_id}:${data.ciclo}`,
    });

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
        asaas_ambiente: "sandbox",
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
        asaas_ambiente: "sandbox",
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