import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";
import { logAdminAction } from "./audit.server";
import { PLAN_IDS, PLANS, type PlanId } from "@/config/plans";

const PlanoConfigEnum = z.enum(PLAN_IDS as [PlanId, ...PlanId[]]);

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("papel_sistema")
        .eq("id", context.userId)
        .maybeSingle();
      const papel = prof?.papel_sistema ?? null;
      const admin = papel === "super_admin" || papel === "admin_operacional" || papel === "admin_suporte";
      return { admin, papel };
    } catch (e) {
      console.error("[isCurrentUserAdmin] unexpected:", e);
      return { admin: false, papel: null };
    }
  });

export const assertAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    return { ok: true };
  });

// ============================================================
// Detalhe do usuário (Bloco admin — página /app/admin/usuarios/:id)
// ============================================================

export type UsuarioDetalhe = {
  profile: {
    id: string;
    nome: string | null;
    email: string | null;
    telefone: string | null;
    oab: string | null;
    tipo_pessoa: string | null;
    cpf_cnpj: string | null;
    razao_social: string | null;
    papel_sistema: string;
    perfil_atuacao: string | null;
    ativo: boolean;
    created_at: string;
    ultimo_acesso: string | null;
  };
  subscription: {
    plano_config_id: PlanId;
    cortesia: boolean;
    cortesia_observacao: string | null;
    status: string;
    trial_end: string | null;
    current_period_end: string | null;
    creditos_mensagens_extras: number;
    custom_preco?: number | null;
    custom_ciclo?: "mensal" | "anual" | null;
    custom_billing_type?: "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD" | null;
    custom_dia_vencimento?: number | null;
    custom_limits?: {
      condominiosMax?: number | null;
      usuariosMax?: number | null;
      mensagensPorMes?: number | null;
      contratosGestaoAtiva?: number | null;
      documentosMax?: number | null;
      minutasAtaConvencao?: boolean;
      painelConsolidado?: boolean;
      relatoriosPorCondominio?: boolean;
      suportePrioritario?: boolean;
    } | null;
    asaas_subscription_id?: string | null;
    asaas_customer_id?: string | null;
  };
  condominios: Array<{ id: string; nome: string; uf: string | null; qtd_unidades: number | null; created_at: string }>;
  usoMes: { mensagens: number; tokens: number; custo_brl: number; mes_ano: string };
  financeiro: { total_mensagens_historico: number; custo_estimado_total_brl: number };
  /**
   * Usuários cadastrados pelo titular nos condomínios que ele possui
   * (operadores/co-administradores). Classificados como "vinculado".
   */
  membrosVinculados: Array<{
    user_id: string;
    nome: string | null;
    email: string | null;
    papel: string;
    condominio_id: string;
    condominio_nome: string;
    created_at: string;
  }>;
  /**
   * Se este usuário é ele próprio um "vinculado" (foi cadastrado por outro
   * titular e não possui condomínio próprio pagante), traz os dados do
   * titular a que está vinculado. `null` quando o usuário é titular ou
   * admin.
   */
  vinculadoA: {
    user_id: string;
    nome: string | null;
    email: string | null;
    condominio_id: string;
    condominio_nome: string;
  } | null;
};

export const getUsuarioDetalheAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<UsuarioDetalhe> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const mesAno = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const [profRes, subRes, condosRes, usoMesRes, historicoRes, membrosRes, minhasMembershipsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select(
        "id, nome, email, telefone, oab, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, perfil_atuacao, ativo, created_at, ultimo_acesso",
      ).eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("subscriptions").select(
        "plano_config_id, cortesia, cortesia_observacao, status, trial_end, current_period_end, creditos_mensagens_extras, custom_preco, custom_ciclo, custom_billing_type, custom_dia_vencimento, custom_limits, asaas_subscription_id, asaas_customer_id",
      ).eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("condominios").select("id, nome, uf, qtd_unidades, created_at").eq("owner_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("uso_mensal").select("total_mensagens, total_tokens, custo_estimado_brl").eq("user_id", data.userId).eq("mes_ano", mesAno).maybeSingle(),
      supabaseAdmin.from("uso_mensal").select("total_mensagens, custo_estimado_brl").eq("user_id", data.userId),
      // Usuários vinculados a este titular (membros dos condos que ele possui)
      supabaseAdmin
        .from("condominio_members")
        .select("user_id, papel, created_at, condominio_id, condominios!inner(nome, owner_id)")
        .eq("condominios.owner_id", data.userId)
        .neq("user_id", data.userId),
      // Este usuário é membro de condo de outro titular?
      supabaseAdmin
        .from("condominio_members")
        .select("condominio_id, condominios!inner(nome, owner_id)")
        .eq("user_id", data.userId),
    ]);

    if (profRes.error || !profRes.data) throw new Error("Usuário não encontrado");

    const rawPlano = (subRes.data?.plano_config_id ?? "personalizado") as string;
    const planoConfigId = (rawPlano in PLANS ? rawPlano : "personalizado") as PlanId;
    const historico = historicoRes.data ?? [];

    // ---------- Hidrata perfis dos membros vinculados ----------
    type MembroRow = {
      user_id: string;
      papel: string;
      created_at: string;
      condominio_id: string;
      condominios: { nome: string; owner_id: string } | null;
    };
    const membrosRows = ((membrosRes.data ?? []) as unknown) as MembroRow[];
    const memberIds = Array.from(new Set(membrosRows.map((m) => m.user_id)));
    const profilesById: Record<string, { nome: string | null; email: string | null }> = {};
    if (memberIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .in("id", memberIds);
      for (const p of profs ?? []) profilesById[p.id] = { nome: p.nome, email: p.email };
    }
    const membrosVinculados = membrosRows
      .map((m) => ({
        user_id: m.user_id,
        nome: profilesById[m.user_id]?.nome ?? null,
        email: profilesById[m.user_id]?.email ?? null,
        papel: m.papel,
        condominio_id: m.condominio_id,
        condominio_nome: m.condominios?.nome ?? "—",
        created_at: m.created_at,
      }))
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));

    // ---------- Verifica se este usuário é ele próprio vinculado ----------
    type MinhaMembershipRow = {
      condominio_id: string;
      condominios: { nome: string; owner_id: string } | null;
    };
    const minhasMemberships = ((minhasMembershipsRes.data ?? []) as unknown) as MinhaMembershipRow[];
    const ehVinculadoDe = minhasMemberships.find(
      (m) => m.condominios && m.condominios.owner_id !== data.userId,
    );
    let vinculadoA: UsuarioDetalhe["vinculadoA"] = null;
    if (ehVinculadoDe && (condosRes.data?.length ?? 0) === 0) {
      const ownerId = ehVinculadoDe.condominios!.owner_id;
      const { data: ownerProf } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .eq("id", ownerId)
        .maybeSingle();
      vinculadoA = {
        user_id: ownerId,
        nome: ownerProf?.nome ?? null,
        email: ownerProf?.email ?? null,
        condominio_id: ehVinculadoDe.condominio_id,
        condominio_nome: ehVinculadoDe.condominios!.nome,
      };
    }

    return {
      profile: profRes.data,
      subscription: {
        plano_config_id: planoConfigId,
        cortesia: subRes.data?.cortesia ?? (planoConfigId === "gratuito"),
        cortesia_observacao: subRes.data?.cortesia_observacao ?? null,
        status: subRes.data?.status ?? "active",
        trial_end: subRes.data?.trial_end ?? null,
        current_period_end: subRes.data?.current_period_end ?? null,
        creditos_mensagens_extras: subRes.data?.creditos_mensagens_extras ?? 0,
        custom_preco: subRes.data?.custom_preco !== undefined && subRes.data?.custom_preco !== null ? Number(subRes.data.custom_preco) : null,
        custom_ciclo: (subRes.data?.custom_ciclo as "mensal" | "anual") ?? "mensal",
        custom_billing_type: (subRes.data?.custom_billing_type as "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD") ?? "UNDEFINED",
        custom_dia_vencimento: subRes.data?.custom_dia_vencimento !== undefined && subRes.data?.custom_dia_vencimento !== null ? Number(subRes.data.custom_dia_vencimento) : 10,
        custom_limits: subRes.data?.custom_limits ?? null,
        asaas_subscription_id: subRes.data?.asaas_subscription_id ?? null,
        asaas_customer_id: subRes.data?.asaas_customer_id ?? null,
      },
      condominios: condosRes.data ?? [],
      usoMes: {
        mensagens: usoMesRes.data?.total_mensagens ?? 0,
        tokens: usoMesRes.data?.total_tokens ?? 0,
        custo_brl: Number(usoMesRes.data?.custo_estimado_brl ?? 0),
        mes_ano: mesAno,
      },
      financeiro: {
        total_mensagens_historico: historico.reduce((s, r) => s + (r.total_mensagens ?? 0), 0),
        custo_estimado_total_brl: historico.reduce((s, r) => s + Number(r.custo_estimado_brl ?? 0), 0),
      },
      membrosVinculados,
      vinculadoA,
    };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      plano_config_id: PlanoConfigEnum.optional(),
      cortesia: z.boolean().optional(),
      cortesia_observacao: z.string().trim().max(500).nullable().optional(),
      // Adicionar N dias ao trial (positivo estende, negativo encurta).
      diasExtras: z.number().int().min(-3650).max(3650).optional(),
      // Definir data específica de fim de trial (ISO).
      trial_end: z.string().datetime().nullable().optional(),
      // Créditos avulsos de mensagens (override absoluto).
      creditos_mensagens_extras: z.number().int().min(0).max(1_000_000).optional(),
      status: z.enum(["active", "aguardando_pagamento", "trialing", "canceled", "past_due"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Carrega estado atual para calcular diasExtras
    const { data: current } = await supabaseAdmin
      .from("subscriptions")
      .select("trial_end, cortesia")
      .eq("user_id", data.userId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (data.plano_config_id !== undefined) patch.plano_config_id = data.plano_config_id;
    if (data.cortesia !== undefined) {
      patch.cortesia = data.cortesia;
      patch.cortesia_concedida_por = data.cortesia ? context.userId : null;
    }
    if (data.cortesia_observacao !== undefined) patch.cortesia_observacao = data.cortesia_observacao;
    if (data.status !== undefined) patch.status = data.status;
    if (data.creditos_mensagens_extras !== undefined) patch.creditos_mensagens_extras = data.creditos_mensagens_extras;

    if (data.trial_end !== undefined) {
      patch.trial_end = data.trial_end;
    } else if (data.diasExtras !== undefined) {
      const base = current?.trial_end ? new Date(current.trial_end).getTime() : Date.now();
      const alvo = base < Date.now() ? Date.now() : base;
      patch.trial_end = new Date(alvo + data.diasExtras * 86400_000).toISOString();
    }

    if (Object.keys(patch).length === 0) return { ok: true };

    // upsert cobre o caso da subscription ainda não existir
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert({ user_id: data.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    // Sincroniza o plano com os usuários vinculados a este titular
    const syncPatch: Record<string, unknown> = {};
    if (patch.plano_config_id !== undefined) syncPatch.plano_config_id = patch.plano_config_id;
    if (patch.cortesia !== undefined) syncPatch.cortesia = patch.cortesia;
    if (patch.cortesia_observacao !== undefined) syncPatch.cortesia_observacao = patch.cortesia_observacao;
    if (patch.status !== undefined) syncPatch.status = patch.status;
    if (Object.keys(syncPatch).length > 0) {
      await supabaseAdmin
        .from("subscriptions")
        .update(syncPatch)
        .eq("vinculado_a_user_id", data.userId);
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "subscription.update",
      targetUserId: data.userId,
      metadata: patch as Record<string, unknown>,
    });

    return { ok: true };
  });

export function calcularProximoVencimento(diaDoMes: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const todayDate = now.getDate();

  const maxDaysThisMonth = new Date(year, month + 1, 0).getDate();
  const diaValidoEsteMes = Math.min(Math.max(1, diaDoMes), maxDaysThisMonth);

  let targetYear = year;
  let targetMonth = month;
  let targetDay = diaValidoEsteMes;

  // Se o dia do vencimento já passou ou é hoje, agenda a 1ª fatura para o próximo mês
  if (todayDate >= diaValidoEsteMes) {
    targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const maxDaysNextMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    targetDay = Math.min(Math.max(1, diaDoMes), maxDaysNextMonth);
  }

  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

const salvarPlanoPersonalizadoSchema = z.object({
  userId: z.string().uuid(),
  valor: z.number().min(0),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  billing_type: z.enum(["UNDEFINED", "PIX", "BOLETO", "CREDIT_CARD"]).default("UNDEFINED"),
  diaVencimento: z.number().int().min(1).max(31).default(10),
  cortesia: z.boolean().default(false),
  cortesia_observacao: z.string().trim().max(500).nullable().optional(),
  gerarCobrancaAsaas: z.boolean().default(true),
  enviarEmailConfirmacao: z.boolean().default(true),
  limites: z.object({
    condominiosMax: z.number().int().min(1).nullable().default(null),
    usuariosMax: z.number().int().min(1).nullable().default(null),
    mensagensPorMes: z.number().int().min(1).nullable().default(null),
    contratosGestaoAtiva: z.number().int().min(1).nullable().default(null),
    documentosMax: z.number().int().min(1).nullable().default(null),
    minutasAtaConvencao: z.boolean().default(true),
    painelConsolidado: z.boolean().default(true),
    relatoriosPorCondominio: z.boolean().default(true),
    suportePrioritario: z.boolean().default(true),
  }),
});

export const adminSalvarPlanoPersonalizado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => salvarPlanoPersonalizadoSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Busca perfil do usuário alvo
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, cpf_cnpj, telefone, razao_social, tipo_pessoa")
      .eq("id", data.userId)
      .maybeSingle();

    if (profErr || !profile) {
      throw new Error("Perfil do usuário não encontrado.");
    }
    if (!profile.email) {
      throw new Error("Usuário não possui e-mail cadastrado.");
    }

    const nextDueDate = calcularProximoVencimento(data.diaVencimento);

    // 2) Salva o plano no banco PRIMEIRO (garante que métricas e limites sejam atualizados)
    const patchSub: Record<string, unknown> = {
      user_id: data.userId,
      plano_config_id: "personalizado",
      status: "active",
      cortesia: data.cortesia,
      cortesia_observacao: data.cortesia_observacao ?? null,
      custom_preco: data.valor,
      custom_ciclo: data.ciclo,
      custom_billing_type: data.billing_type,
      custom_dia_vencimento: data.diaVencimento,
      custom_limits: data.limites,
      updated_at: new Date().toISOString(),
    };

    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(patchSub, { onConflict: "user_id" });

    if (subErr) throw new Error(`Falha ao salvar no banco: ${subErr.message}`);

    // Sincroniza plano personalizado para todos os usuários vinculados a este titular
    await supabaseAdmin
      .from("subscriptions")
      .update({
        plano_config_id: "personalizado",
        status: "active",
        cortesia: data.cortesia,
        custom_preco: data.valor,
        custom_ciclo: data.ciclo,
        custom_billing_type: data.billing_type,
        custom_dia_vencimento: data.diaVencimento,
        custom_limits: data.limites,
      })
      .eq("vinculado_a_user_id", data.userId);

    let asaasCustomerId: string | null = null;
    let asaasSubscriptionId: string | null = null;
    let asaasError: string | null = null;

    // 3) Se for gerar cobrança no Asaas, valor > 0 e não for cortesia
    if (data.gerarCobrancaAsaas && data.valor > 0 && !data.cortesia) {
      try {
        const asaas = await import("./asaas.server");

        const nomeCliente =
          profile.tipo_pessoa === "pj" && profile.razao_social
            ? profile.razao_social
            : profile.nome || profile.email;

        const customer = await asaas.ensureCustomer({
          name: nomeCliente,
          email: profile.email,
          cpfCnpj: profile.cpf_cnpj ?? undefined,
          mobilePhone: profile.telefone ?? undefined,
          externalReference: data.userId,
        });

        asaasCustomerId = customer.id;

        const cycle: "MONTHLY" | "YEARLY" = data.ciclo === "anual" ? "YEARLY" : "MONTHLY";

        const subscription = await asaas.createSubscription({
          customerId: customer.id,
          value: data.valor,
          cycle,
          billingType: data.billing_type,
          nextDueDate,
          description: `Assinatura Plano Personalizado (Vencimento todo dia ${data.diaVencimento}) — Augusto.IJ (${data.ciclo})`,
          externalReference: `${data.userId}:personalizado:${data.ciclo}`,
        });

        asaasSubscriptionId = subscription.id;

        // Atualiza os IDs do Asaas na assinatura salva
        await supabaseAdmin
          .from("subscriptions")
          .update({
            asaas_customer_id: asaasCustomerId,
            asaas_subscription_id: asaasSubscriptionId,
          })
          .eq("user_id", data.userId);
      } catch (err) {
        console.error("[adminSalvarPlanoPersonalizado] Erro na automação Asaas:", err);
        asaasError = err instanceof Error ? err.message : String(err);
      }
    }

    // 4) Disparo do e-mail de confirmação ao usuário
    if (data.enviarEmailConfirmacao) {
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (RESEND_API_KEY) {
        try {
          const valorFormatado = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(data.valor);

          const [ano, mes, dia] = nextDueDate.split("-");
          const primeiroVencFormatado = `${dia}/${mes}/${ano}`;

          const cicloTexto = data.ciclo === "anual" ? "Anual" : "Mensal";
          const condominiosTexto = data.limites.condominiosMax ? `${data.limites.condominiosMax} condomínio(s)` : "Ilimitado";
          const usuariosTexto = data.limites.usuariosMax ? `${data.limites.usuariosMax} usuário(s)` : "Ilimitado";
          const mensagensTexto = data.limites.mensagensPorMes ? `${data.limites.mensagensPorMes.toLocaleString("pt-BR")} mensagens/mês` : "Ilimitadas";
          const contratosTexto = data.limites.contratosGestaoAtiva ? `${data.limites.contratosGestaoAtiva} contratos ativos` : "Ilimitados";

          const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 24px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #0f2d25; padding: 28px 32px; text-align: center;">
      <h1 style="color: #c5a880; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Augusto.IJ</h1>
      <p style="color: #cbd5e1; margin: 6px 0 0 0; font-size: 13px;">Inteligência Jurídica & Gestão Condominial</p>
    </div>
    <div style="padding: 32px;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Plano Personalizado Ativado!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Olá, <strong>${profile.nome || "Cliente"}</strong>. Seu <strong>Plano Personalizado</strong> foi configurado e ativado com sucesso em sua conta.
      </p>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #0f2d25; text-transform: uppercase; letter-spacing: 0.5px;">Condições do Plano</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: #64748b;">Investimento:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${valorFormatado} / ${cicloTexto}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Vencimento:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">Todo dia ${data.diaVencimento} (1ª fatura: ${primeiroVencFormatado})</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Condomínios inclusos:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${condominiosTexto}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Membros da Equipe:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${usuariosTexto}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Mensagens IA:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${mensagensTexto}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Gestão Contínua de Contratos:</td><td style="padding: 4px 0; font-weight: 600; text-align: right; color: #0f172a;">${contratosTexto}</td></tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        As faturas e opções de pagamento (PIX, Boleto ou Cartão) serão encaminhadas automaticamente antes de cada vencimento.
      </p>

      <div style="margin-top: 28px; text-align: center;">
        <a href="https://augustoij.com.br/login" style="display: inline-block; background: #0f2d25; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
          Acessar a Plataforma
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Augusto.IJ <notificacoes@augustoij.com.br>",
              to: [profile.email],
              subject: "Seu Plano Personalizado Augusto.IJ foi Ativado!",
              html,
            }),
          });
        } catch (mailErr) {
          console.error("[adminSalvarPlanoPersonalizado] Falha ao disparar e-mail:", mailErr);
        }
      }
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: "subscription.custom_plan_saved",
      targetUserId: data.userId,
      metadata: {
        valor: data.valor,
        ciclo: data.ciclo,
        diaVencimento: data.diaVencimento,
        cortesia: data.cortesia,
        asaas_subscription_id: asaasSubscriptionId,
        asaas_error: asaasError,
      },
    });

    return {
      ok: true,
      asaas_subscription_id: asaasSubscriptionId,
      asaas_error: asaasError,
    };
  });

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("admin_dashboard_metrics");
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  });

export const getUsageTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ days: z.number().int().min(1).max(180).default(30) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("admin_usage_timeseries", { _days: data.days });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export function calcularReceitaMensalSub(sub: {
  plano_config_id?: string | null;
  cortesia?: boolean | null;
  vinculado_a_user_id?: string | null;
  custom_preco?: number | null;
  custom_ciclo?: string | null;
  status?: string | null;
}): number {
  if (sub.cortesia || sub.vinculado_a_user_id) return 0;
  if (sub.status !== "active" && sub.status !== "trialing") return 0;

  const planoId = sub.plano_config_id as PlanId | undefined;
  if (!planoId || planoId === "gratuito") return 0;

  if (planoId === "personalizado") {
    const valor = Number(sub.custom_preco ?? 0);
    if (sub.custom_ciclo === "anual") {
      return Number((valor / 12).toFixed(2));
    }
    return valor;
  }

  const precosPadrao: Record<string, number> = {
    essencial: 97,
    profissional: 247,
    gestao: 447,
    administradora: 997,
  };
  return precosPadrao[planoId] ?? 0;
}

/**
 * Visão geral do negócio para o dashboard admin.
 * Consolida receita (MRR/ARR oficial), custo Lovable/IA, unit economics,
 * atividade diária e saúde operacional em uma única chamada.
 */
export type AdminOverview = {
  mes: string;
  mrr: number;
  arr: number;
  arpu: number;
  novos_usuarios_mes: number;
  margem_mes: number;
  margem_percentual: number;
  custo_lovable_mes: number;
  despesas_mes: number;
  assinaturas: {
    ativas: number;
    pagantes: number;
    trialing: number;
    cortesia: number;
    vinculados: number;
    canceladas: number;
    total: number;
  };
  distribuicao_planos: Array<{ plano: string; quantidade: number; receita: number }>;
  serie_receita_custo: Array<{ mes: string; receita: number; custo: number; lucro: number }>;
  serie_mensagens: Array<{ dia: string; mensagens: number }>;
  operacional: {
    condominios_total: number;
    condominios_ativos_mes: number;
    unidades_total: number;
    media_unidades_por_condominio: number;
    media_condominios_por_cliente: number;
    documentos_total: number;
    documentos_erro: number;
    kb_prontos: number;
    kb_total: number;
    storage_mb: number;
  };
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const mesAtual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const primeiroDiaAtual = `${mesAtual}-01`;

    // 6 meses de histórico (inclui atual)
    const meses: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const seisMesesAtras = `${meses[0]}-01`;

    const [
      subsRes,
      profilesMesRes,
      condosRes,
      docsRes,
      kbRes,
      usoMesesRes,
      despesasRes,
      serieRes,
      condosAtivosRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plano_config_id, status, cortesia, custom_preco, custom_ciclo, vinculado_a_user_id, created_at, updated_at, current_period_end"),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${primeiroDiaAtual}T00:00:00Z`),
      supabaseAdmin.from("condominios").select("id, owner_id, qtd_unidades"),
      supabaseAdmin.from("documentos").select("id, status_processamento"),
      supabaseAdmin.from("kb_documentos").select("id, status_processamento"),
      supabaseAdmin
        .from("uso_mensal")
        .select("mes_ano, custo_estimado_brl, total_credits")
        .gte("mes_ano", meses[0]),
      supabaseAdmin
        .from("despesas")
        .select("valor, data")
        .gte("data", seisMesesAtras),
      supabaseAdmin.rpc("admin_usage_timeseries", { _days: 30 }),
      supabaseAdmin.rpc("admin_dashboard_metrics"),
    ]);

    // MRR = soma da receita mensal dos planos ativos/trial dos titulares
    let mrr = 0;
    const distMap: Record<string, { quantidade: number; receita: number }> = {};
    let pagantes = 0, trialing = 0, cortesia = 0, vinculados = 0, canceladas = 0;

    const subs = subsRes.data ?? [];
    for (const s of subs) {
      const planoId = (s.plano_config_id as PlanId) ?? "gratuito";
      const nomePlano = s.cortesia
        ? "Cortesia"
        : s.vinculado_a_user_id
          ? "Vinculado (Equipe)"
          : (PLANS[planoId]?.nome ?? planoId);

      const rec = calcularReceitaMensalSub(s);

      if (!distMap[nomePlano]) distMap[nomePlano] = { quantidade: 0, receita: 0 };
      distMap[nomePlano].quantidade++;
      distMap[nomePlano].receita += rec;

      if (s.vinculado_a_user_id) {
        vinculados++;
      } else if (s.cortesia) {
        cortesia++;
      } else if (s.status === "active") {
        pagantes++;
        mrr += rec;
      } else if (s.status === "trialing") {
        trialing++;
      } else if (s.status === "canceled") {
        canceladas++;
      }
    }

    const arr = mrr * 12;
    const arpu = pagantes > 0 ? Number((mrr / pagantes).toFixed(2)) : 0;

    const distribuicao_planos = Object.entries(distMap)
      .map(([plano, d]) => ({ plano, quantidade: d.quantidade, receita: Number(d.receita.toFixed(2)) }))
      .sort((a, b) => b.receita - a.receita || b.quantidade - a.quantidade);

    // Série receita × custo dos últimos 6 meses
    const custoPorMes: Record<string, number> = {};
    for (const u of usoMesesRes.data ?? []) {
      const m = String(u.mes_ano);
      custoPorMes[m] = (custoPorMes[m] ?? 0) + Number(u.custo_estimado_brl ?? 0);
    }

    const serie_receita_custo = meses.map((m) => {
      const [yy, mm] = m.split("-").map((v) => Number(v));
      const inicioMes = new Date(Date.UTC(yy, mm - 1, 1));
      const fimMes = new Date(Date.UTC(yy, mm, 1));
      let receitaMes = 0;
      for (const s of subs) {
        if (s.cortesia || s.vinculado_a_user_id) continue;
        const criadoEm = s.created_at ? new Date(s.created_at) : null;
        if (!criadoEm || criadoEm >= fimMes) continue;
        if (s.status === "canceled") {
          const fimEm = s.updated_at ? new Date(s.updated_at) : null;
          if (!fimEm || fimEm < inicioMes) continue;
        } else if (s.status !== "active") {
          continue;
        }
        receitaMes += calcularReceitaMensalSub(s);
      }
      const c = Number((custoPorMes[m] ?? 0).toFixed(2));
      const r = Number(receitaMes.toFixed(2));
      return {
        mes: m,
        receita: r,
        custo: c,
        lucro: Number((r - c).toFixed(2)),
      };
    });

    const custo_lovable_mes = custoPorMes[mesAtual] ?? 0;
    const despesas_mes = (despesasRes.data ?? [])
      .filter((d) => String(d.data).startsWith(mesAtual))
      .reduce((a, d) => a + Number(d.valor ?? 0), 0);
    const margem_mes = mrr - custo_lovable_mes - despesas_mes;
    const margem_percentual = mrr > 0 ? Number(((margem_mes / mrr) * 100).toFixed(1)) : 0;

    // Métricas operacionais e de condomínios
    const condominios = condosRes.data ?? [];
    const ownerIds = Array.from(new Set(condominios.map((c) => c.owner_id).filter(Boolean)));
    const unidades_total = condominios.reduce((acc, c) => acc + Number(c.qtd_unidades || 0), 0);
    const condominios_total = condominios.length;
    const media_unidades_por_condominio = condominios_total > 0 ? Math.round(unidades_total / condominios_total) : 0;
    const media_condominios_por_cliente = pagantes > 0 ? Number((condominios_total / pagantes).toFixed(1)) : 0;

    let storageBytes = 0;
    for (const uid of ownerIds) {
      const { data } = await supabaseAdmin.rpc("storage_bytes_by_user", { _user_id: uid });
      storageBytes += Number(data ?? 0);
    }

    const metrics = (serieRes.data as { dia: string; mensagens: number }[] | null) ?? [];
    const opsMetrics = (condosAtivosRes.data ?? {}) as Record<string, number>;

    return {
      mes: mesAtual,
      mrr: Number(mrr.toFixed(2)),
      arr: Number(arr.toFixed(2)),
      arpu,
      novos_usuarios_mes: profilesMesRes.count ?? 0,
      margem_mes: Number(margem_mes.toFixed(2)),
      margem_percentual,
      custo_lovable_mes: Number(custo_lovable_mes.toFixed(2)),
      despesas_mes: Number(despesas_mes.toFixed(2)),
      assinaturas: {
        ativas: pagantes,
        pagantes,
        trialing,
        cortesia,
        vinculados,
        canceladas,
        total: subs.length,
      },
      distribuicao_planos,
      serie_receita_custo,
      serie_mensagens: metrics.map((r) => ({ dia: String(r.dia), mensagens: Number(r.mensagens) })),
      operacional: {
        condominios_total,
        condominios_ativos_mes: Number(opsMetrics.condominios_ativos_mes ?? 0),
        unidades_total,
        media_unidades_por_condominio,
        media_condominios_por_cliente,
        documentos_total: (docsRes.data ?? []).length,
        documentos_erro: (docsRes.data ?? []).filter((d) => String(d.status_processamento ?? "").startsWith("erro")).length,
        kb_prontos: (kbRes.data ?? []).filter((k) => k.status_processamento === "pronto").length,
        kb_total: (kbRes.data ?? []).length,
        storage_mb: storageBytes / 1048576,
      },
    };
  });

export const listUsuariosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      search: z.string().trim().max(120).default(""),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("admin_list_users", {
      _search: data.search,
      _limit: data.limit,
      _offset: data.offset,
    });
    if (error) throw new Error(error.message);

    // Hidrata dados de vinculação e planos herdados
    const userRows = (rows ?? []) as Array<any>;
    if (userRows.length === 0) return [];

    const userIds = userRows.map((r) => r.id);

    // Busca profiles para pegar criado_por e memberships
    const [profRes, memRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, criado_por").in("id", userIds),
      supabaseAdmin.from("condominio_members").select("user_id, criado_por").in("user_id", userIds),
    ]);

    const criadoPorMap = new Map<string, string>();
    for (const p of profRes.data ?? []) {
      if (p.criado_por && p.criado_por !== p.id) criadoPorMap.set(p.id, p.criado_por);
    }
    for (const m of memRes.data ?? []) {
      if (m.criado_por && m.criado_por !== m.user_id && !criadoPorMap.has(m.user_id)) {
        criadoPorMap.set(m.user_id, m.criado_por);
      }
    }

    const ownerIds = Array.from(new Set(Array.from(criadoPorMap.values()).filter(Boolean)));

    let ownersMap: Record<string, { nome: string | null; email: string | null; plano_config_id: string | null }> = {};
    if (ownerIds.length > 0) {
      const [ownersProf, ownersSub] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, nome, email").in("id", ownerIds),
        supabaseAdmin.from("subscriptions").select("user_id, plano_config_id").in("user_id", ownerIds),
      ]);
      const subByOwner = new Map((ownersSub.data ?? []).map((s) => [s.user_id, s.plano_config_id]));
      for (const op of ownersProf.data ?? []) {
        ownersMap[op.id] = {
          nome: op.nome,
          email: op.email,
          plano_config_id: subByOwner.get(op.id) ?? "gestao",
        };
      }
    }

    return userRows.map((u) => {
      const ownerId = u.vinculado_a_id || criadoPorMap.get(u.id);
      const ownerInfo = ownerId ? ownersMap[ownerId] : null;

      const planoFinal = ownerInfo?.plano_config_id || u.plano_config_id || u.plano || "gratuito";

      return {
        ...u,
        plano: planoFinal,
        plano_config_id: planoFinal,
        vinculado_a_id: ownerId ?? null,
        vinculado_a_nome: ownerInfo?.nome || u.vinculado_a_nome || null,
        vinculado_a_email: ownerInfo?.email || u.vinculado_a_email || null,
      };
    });
  });

export const listCondominiosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("condominios")
      .select("id, nome, uf, cidade, qtd_unidades, owner_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)));
    let ownersById: Record<string, { email: string | null; nome: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabaseAdmin
        .from("profiles")
        .select("id, email, nome")
        .in("id", ownerIds);
      ownersById = Object.fromEntries((owners ?? []).map((o) => [o.id, { email: o.email, nome: o.nome }]));
    }
    return rows.map((r) => ({ ...r, profiles: ownersById[r.owner_id] ?? null }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      papel: z.enum([
        "super_admin",
        "admin_operacional",
        "admin_suporte",
        "cliente_pf",
        "cliente_pj_dono",
        "cliente_pj_operador",
      ]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bloqueia auto-rebaixamento do último super_admin
    if (data.papel !== "super_admin" && data.userId === context.userId) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("papel_sistema", "super_admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Não é possível remover o último super administrador");
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ papel_sistema: data.papel })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "role.set",
      targetUserId: data.userId,
      metadata: { papel: data.papel },
    });

    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(100),
        action: z.string().trim().max(80).default(""),
        search: z.string().trim().max(120).default(""),
        sinceDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    let q = context.supabase
      .from("admin_audit_log")
      .select("id, actor_user_id, action, target_user_id, target_condominio_id, target_kb_id, metadata, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.sinceDays) {
      const since = new Date(Date.now() - data.sinceDays * 86400_000).toISOString();
      q = q.gte("created_at", since);
    }
    if (data.search) {
      // busca em IP ou em metadados (texto)
      q = q.or(`ip_address.ilike.%${data.search}%,metadata::text.ilike.%${data.search}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const userIds = Array.from(
      new Set(
        list
          .flatMap((r) => [r.actor_user_id, r.target_user_id])
          .filter((x): x is string => !!x),
      ),
    );
    let profiles: Record<string, { nome: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      profiles = Object.fromEntries(
        (profs ?? []).map((p) => [p.id, { nome: p.nome ?? null, email: p.email ?? null }]),
      );
    }
    return list.map((r) => ({
      ...r,
      actor: profiles[r.actor_user_id] ?? null,
      target_user: r.target_user_id ? profiles[r.target_user_id] ?? null : null,
    }));
  });

/**
 * Cria um usuário manualmente (somente admin). Útil para onboarding interno
 * e para criar contas operacionais sem precisar do fluxo público.
 */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      nome: z.string().trim().min(2).max(120),
      password: z
        .string()
        .min(8, "Senha deve ter no mínimo 8 caracteres")
        .max(72)
        .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
        .regex(/[0-9]/, "Inclua ao menos um número"),
      papel: z
        .enum([
          "super_admin",
          "admin_operacional",
          "admin_suporte",
          "cliente_pf",
          "cliente_pj_dono",
          "cliente_pj_operador",
        ])
        .default("cliente_pf"),
      perfil_atuacao: z
        .enum(["sindico", "advogado", "administradora", "conselheiro", "outro"])
        .optional(),
      plano_config_id: PlanoConfigEnum.optional(),
      cortesia: z.boolean().optional(),
      observacao: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        perfil_atuacao: data.perfil_atuacao ?? null,
      },
    });
    if (error) throw new Error(error.message);
    const newUserId = created?.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário.");

    // Upsert do perfil com papel + perfil_atuacao
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUserId,
        email: data.email.toLowerCase().trim(),
        nome: data.nome,
        papel_sistema: data.papel,
        perfil_atuacao: data.perfil_atuacao ?? null,
        onboarding_completo: true,
      }, { onConflict: "id" });
    if (upErr) throw new Error(upErr.message);

    // Assinatura: por padrão CORTESIA (sem limites). Se o admin escolheu um
    // plano específico, gravamos com status 'aguardando_pagamento' para o
    // usuário ser redirecionado ao checkout no primeiro login.
    const planoConfigId: PlanId = data.plano_config_id ?? "personalizado";
    const cortesia = data.cortesia ?? true;
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: newUserId,
        plano_config_id: planoConfigId,
        cortesia,
        cortesia_concedida_por: cortesia ? context.userId : null,
        cortesia_observacao: cortesia ? (data.observacao ?? "Conta criada pelo admin") : null,
        status: cortesia ? "active" : "aguardando_pagamento",
        trial_end: cortesia ? null : new Date(Date.now() + 7 * 86400_000).toISOString(),
      },
      { onConflict: "user_id" },
    );

    await logAdminAction({
      actorUserId: context.userId,
      action: "user.create",
      targetUserId: newUserId,
      metadata: {
        email: data.email,
        papel: data.papel,
        perfil: data.perfil_atuacao ?? null,
        plano_config_id: planoConfigId,
        cortesia,
      },
    });

    return { ok: true, userId: newUserId };
  });

/**
 * Bloco 6 — Desativa (ou reativa) um usuário.
 * Mantém todos os dados; bloqueia o login via Supabase Auth (`ban_duration`)
 * e marca `profiles.ativo = false`.
 */
export const setUserAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      ativo: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId && !data.ativo) {
      throw new Error("Você não pode desativar a própria conta.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se for desativar um super_admin, garante que sobre pelo menos um ativo.
    if (!data.ativo) {
      const { data: alvo } = await supabaseAdmin
        .from("profiles")
        .select("papel_sistema")
        .eq("id", data.userId)
        .maybeSingle();
      if (alvo?.papel_sistema === "super_admin") {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("papel_sistema", "super_admin")
          .eq("ativo", true);
        if ((count ?? 0) <= 1) {
          throw new Error("Não é possível desativar o último super administrador ativo.");
        }
      }
    }

    // 1) Atualiza flag no perfil
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ ativo: data.ativo })
      .eq("id", data.userId);
    if (upErr) throw new Error(upErr.message);

    // 2) Bloqueia/desbloqueia o login via Auth admin
    try {
      // 100 anos ≈ desativação permanente; "none" reabilita.
      const ban_duration = data.ativo ? "none" : "876000h";
      await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        ban_duration,
      } as unknown as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1]);
    } catch (e) {
      console.warn("[setUserAtivo] auth.updateUserById falhou:", e);
    }

    await logAdminAction({
      actorUserId: context.userId,
      action: data.ativo ? "user.activate" : "user.deactivate",
      targetUserId: data.userId,
      metadata: { ativo: data.ativo },
    });

    return { ok: true };
  });