import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";
import { logAdminAction } from "./audit.server";

export const getFinanceiroResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Receita: somar preço dos planos ativos por assinatura
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("plano_id, status");
    const planoIds = Array.from(new Set((subs ?? []).map((s) => s.plano_id).filter(Boolean) as string[]));
    let planosMap: Record<string, number> = {};
    if (planoIds.length) {
      const { data: planos } = await supabaseAdmin
        .from("planos")
        .select("id, preco_mensal")
        .in("id", planoIds);
      planosMap = Object.fromEntries((planos ?? []).map((p) => [p.id, Number(p.preco_mensal ?? 0)]));
    }
    const mrr = (subs ?? [])
      .filter((s) => s.status === "active" || s.status === "trialing")
      .reduce((acc, s) => acc + (planosMap[s.plano_id ?? ""] ?? 0), 0);
    const ativos = (subs ?? []).filter((s) => s.status === "active").length;
    const ticket = ativos > 0 ? mrr / ativos : 0;

    const mes = new Date().toISOString().slice(0, 7);
    const { data: custos } = await supabaseAdmin
      .from("custos_cliente_mensal")
      .select("custo_tokens_openai, custo_embeddings, custo_storage, user_id, margem_estimada")
      .gte("mes_ano", `${mes}-01`);
    const custoTotal = (custos ?? []).reduce(
      (acc, c) => acc + Number(c.custo_tokens_openai) + Number(c.custo_embeddings) + Number(c.custo_storage),
      0,
    );
    const { data: despesas } = await supabaseAdmin
      .from("despesas")
      .select("valor")
      .gte("data", `${mes}-01`)
      .eq("owner_admin_id", context.userId);
    const despesasTotal = (despesas ?? []).reduce((a, d) => a + Number(d.valor), 0);

    return {
      mrr,
      ticket_medio: ticket,
      assinaturas_ativas: ativos,
      custos_clientes_mes: custoTotal,
      despesas_mes: despesasTotal,
      margem_mes: mrr - custoTotal - despesasTotal,
    };
  });

export const listCustosClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mes = new Date().toISOString().slice(0, 7);
    const { data, error } = await supabaseAdmin
      .from("custos_cliente_mensal")
      .select("user_id, custo_tokens_openai, custo_embeddings, custo_storage, total_mensagens, margem_estimada")
      .gte("mes_ano", `${mes}-01`)
      .order("custo_tokens_openai", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((d) => d.user_id)));
    let nomes: Record<string, { nome: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", ids);
      nomes = Object.fromEntries((p ?? []).map((x) => [x.id, { nome: x.nome, email: x.email }]));
    }
    return (data ?? []).map((r) => ({ ...r, profile: nomes[r.user_id] ?? null }));
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