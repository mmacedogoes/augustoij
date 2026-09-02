import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";
import { logAdminAction } from "./audit.server";
import { PLANS, type PlanId } from "@/config/plans";
import { calcularReceitaMensalSub } from "./admin.functions";

export const getFinanceiroResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Busca todas as assinaturas
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plano_config_id, status, cortesia, custom_preco, custom_ciclo, vinculado_a_user_id, created_at");

    let mrr = 0;
    let ativos = 0;
    let cortesiaCount = 0;
    let vinculadosCount = 0;

    for (const s of subs ?? []) {
      if (s.vinculado_a_user_id) {
        vinculadosCount++;
      } else if (s.cortesia) {
        cortesiaCount++;
      } else if (s.status === "active") {
        ativos++;
        mrr += calcularReceitaMensalSub(s);
      }
    }

    const arr = mrr * 12;
    const ticket = ativos > 0 ? mrr / ativos : 0;

    const now = new Date();
    const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    // 2) Busca custos de IA e consumo em uso_mensal
    const { data: usoMes } = await supabaseAdmin
      .from("uso_mensal")
      .select("custo_estimado_brl")
      .eq("mes_ano", mes);

    const custoTotal = (usoMes ?? []).reduce(
      (acc, c) => acc + Number(c.custo_estimado_brl ?? 0),
      0,
    );

    // 3) Busca despesas operacionais do mês
    const { data: despesas } = await supabaseAdmin
      .from("despesas")
      .select("valor, data")
      .gte("data", `${mes}-01`)
      .lte("data", `${mes}-31`);

    const despesasTotal = (despesas ?? []).reduce((a, d) => a + Number(d.valor ?? 0), 0);
    const margemMes = mrr - custoTotal - despesasTotal;
    const margemPercentual = mrr > 0 ? Number(((margemMes / mrr) * 100).toFixed(1)) : 0;

    return {
      mrr: Number(mrr.toFixed(2)),
      arr: Number(arr.toFixed(2)),
      ticket_medio: Number(ticket.toFixed(2)),
      assinaturas_ativas: ativos,
      assinaturas_cortesia: cortesiaCount,
      assinaturas_vinculadas: vinculadosCount,
      custos_clientes_mes: Number(custoTotal.toFixed(2)),
      despesas_mes: Number(despesasTotal.toFixed(2)),
      margem_mes: Number(margemMes.toFixed(2)),
      margem_percentual: margemPercentual,
    };
  });

export type AssinaturaReceitaRow = {
  user_id: string;
  profile: {
    nome: string | null;
    email: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
    razao_social: string | null;
    tipo_pessoa: string | null;
  } | null;
  plano_config_id: string;
  plano_nome: string;
  valor_mensal: number;
  ciclo: "mensal" | "anual";
  dia_vencimento: number | null;
  status: string;
  cortesia: boolean;
  vinculado_a_id: string | null;
  vinculado_a_nome: string | null;
  asaas_subscription_id: string | null;
  created_at: string;
};

export const listAssinaturasReceita = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssinaturaReceitaRow[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [subsRes, profsRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plano_config_id, status, cortesia, custom_preco, custom_ciclo, custom_dia_vencimento, vinculado_a_user_id, asaas_subscription_id, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("profiles")
        .select("id, nome, email, telefone, cpf_cnpj, razao_social, tipo_pessoa"),
    ]);

    const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p]));

    return (subsRes.data ?? []).map((s) => {
      const planoId = (s.plano_config_id as PlanId) ?? "gratuito";
      const planoDef = PLANS[planoId];
      const p = profMap.get(s.user_id) ?? null;
      const owner = s.vinculado_a_user_id ? profMap.get(s.vinculado_a_user_id) : null;
      const valorMensal = calcularReceitaMensalSub(s);

      return {
        user_id: s.user_id,
        profile: p
          ? {
              nome: p.nome,
              email: p.email,
              telefone: p.telefone,
              cpf_cnpj: p.cpf_cnpj,
              razao_social: p.razao_social,
              tipo_pessoa: p.tipo_pessoa,
            }
          : null,
        plano_config_id: planoId,
        plano_nome: s.cortesia ? "Cortesia" : (planoDef?.nome ?? planoId),
        valor_mensal: valorMensal,
        ciclo: (s.custom_ciclo as "mensal" | "anual") ?? "mensal",
        dia_vencimento: s.custom_dia_vencimento ?? 10,
        status: s.status,
        cortesia: s.cortesia ?? false,
        vinculado_a_id: s.vinculado_a_user_id ?? null,
        vinculado_a_nome: owner?.nome || owner?.email || null,
        asaas_subscription_id: s.asaas_subscription_id ?? null,
        created_at: s.created_at,
      };
    });
  });

export const listCustosClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const [usoRes, subsRes, profsRes] = await Promise.all([
      supabaseAdmin
        .from("uso_mensal")
        .select("user_id, total_mensagens, total_tokens, custo_estimado_brl, total_credits")
        .eq("mes_ano", mes)
        .order("custo_estimado_brl", { ascending: false })
        .limit(150),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, plano_config_id, status, cortesia, custom_preco, custom_ciclo, vinculado_a_user_id"),
      supabaseAdmin
        .from("profiles")
        .select("id, nome, email, razao_social, tipo_pessoa"),
    ]);

    const subMap = new Map((subsRes.data ?? []).map((s) => [s.user_id, s]));
    const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p]));

    return (usoRes.data ?? []).map((u) => {
      const sub = subMap.get(u.user_id);
      const prof = profMap.get(u.user_id);
      const planoId = (sub?.plano_config_id as PlanId) ?? "gratuito";
      const planoNome = sub?.cortesia ? "Cortesia" : (PLANS[planoId]?.nome ?? planoId);
      const receitaMensal = sub ? calcularReceitaMensalSub(sub) : 0;
      const custoIA = Number(u.custo_estimado_brl ?? 0);
      const margemBrl = receitaMensal - custoIA;
      const margemPct = receitaMensal > 0 ? Number(((margemBrl / receitaMensal) * 100).toFixed(1)) : 0;

      return {
        user_id: u.user_id,
        profile: prof ? { nome: prof.nome, email: prof.email, razao_social: prof.razao_social, tipo_pessoa: prof.tipo_pessoa } : null,
        plano_config_id: planoId,
        plano_nome: planoNome,
        receita_mensal: receitaMensal,
        total_mensagens: Number(u.total_mensagens ?? 0),
        total_tokens: Number(u.total_tokens ?? 0),
        custo_ia_brl: custoIA,
        margem_brl: Number(margemBrl.toFixed(2)),
        margem_pct: margemPct,
      };
    });
  });

export const listDespesas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("despesas")
      .select("id, descricao, categoria, valor, data, recorrente, periodicidade")
      .eq("owner_admin_id", context.userId)
      .order("data", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        descricao: z.string().trim().min(1).max(200),
        categoria: z.string().trim().min(1).max(80),
        valor: z.number().positive(),
        data: z.string().min(8),
        recorrente: z.boolean().default(false),
        periodicidade: z.string().max(40).default("mensal"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("despesas").insert({
      descricao: data.descricao,
      categoria: data.categoria,
      valor: data.valor,
      data: data.data,
      recorrente: data.recorrente,
      periodicidade: data.periodicidade,
      created_by: context.userId,
      owner_admin_id: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await logAdminAction({
      actorUserId: context.userId,
      action: "despesa.create",
      metadata: {
        id: row?.id,
        descricao: data.descricao,
        categoria: data.categoria,
        valor: data.valor,
        data: data.data,
      },
    });
    return { ok: true };
  });

export const deleteDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("despesas")
      .delete()
      .eq("id", data.id)
      .eq("owner_admin_id", context.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      actorUserId: context.userId,
      action: "despesa.delete",
      metadata: { id: data.id },
    });
    return { ok: true };
  });

/**
 * Cancelamentos: motivos declarados pelos clientes, agregados para acompanhamento.
 */
export const listCancelamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("cancelamentos")
      .select("id, user_id, plano_config_id, motivo, detalhes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((data ?? []).map((d) => d.user_id)));
    let nomes: Record<string, { nome: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      nomes = Object.fromEntries((p ?? []).map((x) => [x.id, { nome: x.nome, email: x.email }]));
    }

    const porMotivo = new Map<string, number>();
    for (const c of data ?? []) {
      porMotivo.set(c.motivo, (porMotivo.get(c.motivo) ?? 0) + 1);
    }

    return {
      rows: (data ?? []).map((r) => ({ ...r, profile: nomes[r.user_id] ?? null })),
      agregado: Array.from(porMotivo.entries())
        .map(([motivo, total]) => ({ motivo, total }))
        .sort((a, b) => b.total - a.total),
    };
  });