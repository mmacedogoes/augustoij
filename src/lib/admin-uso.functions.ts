import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

function mesAtual(): { mes: string; primeiroDia: string } {
  const d = new Date();
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { mes, primeiroDia: `${mes}-01` };
}

export const getUsoOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mes } = mesAtual();

    const [{ data: uso }, { data: docs }, { data: msgsErro }, { data: kb }] = await Promise.all([
      supabaseAdmin.from("uso_mensal").select("total_mensagens, total_tokens, custo_estimado_brl, user_id").eq("mes_ano", mes),
      supabaseAdmin.from("documentos").select("id, status_processamento"),
      supabaseAdmin.from("mensagens").select("id", { count: "exact", head: true }).gte("created_at", `${mes}-01`),
      supabaseAdmin.from("kb_documentos").select("id, status_processamento"),
    ]);

    const totalMsgs = (uso ?? []).reduce((a, r) => a + (r.total_mensagens ?? 0), 0);
    const totalTokens = (uso ?? []).reduce((a, r) => a + (r.total_tokens ?? 0), 0);
    const custoIA = (uso ?? []).reduce((a, r) => a + Number(r.custo_estimado_brl ?? 0), 0);
    const usuariosAtivos = new Set((uso ?? []).map((r) => r.user_id)).size;

    const { data: storageAgg } = await supabaseAdmin
      .from("condominios")
      .select("owner_id");
    const ownerIds = Array.from(new Set((storageAgg ?? []).map((c) => c.owner_id)));
    let storageBytesTotal = 0;
    for (const uid of ownerIds) {
      const { data } = await supabaseAdmin.rpc("storage_bytes_by_user", { _user_id: uid });
      storageBytesTotal += Number(data ?? 0);
    }

    // série temporal
    const { data: serie } = await supabaseAdmin.rpc("admin_usage_timeseries", { _days: 30 });

    return {
      mes,
      total_mensagens: totalMsgs,
      total_tokens: totalTokens,
      custo_ia_brl: custoIA,
      usuarios_ativos: usuariosAtivos,
      documentos_total: docs?.length ?? 0,
      documentos_erro: (docs ?? []).filter((d) => (d.status_processamento ?? "").startsWith("erro")).length,
      kb_total: kb?.length ?? 0,
      kb_prontos: (kb ?? []).filter((k) => k.status_processamento === "pronto").length,
      storage_mb: storageBytesTotal / 1048576,
      mensagens_totais_mes: msgsErro ?? 0,
      serie: serie ?? [],
    };
  });

export const listUsoPorUsuario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mes } = mesAtual();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .order("created_at", { ascending: false })
      .limit(500);

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const [{ data: subs }, { data: usos }, { data: custos }, { data: planos }, { data: cfg }] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("user_id, plano_id, status").in("user_id", ids),
      supabaseAdmin.from("uso_mensal").select("user_id, total_mensagens, total_tokens, custo_estimado_brl").eq("mes_ano", mes).in("user_id", ids),
      supabaseAdmin.from("custos_cliente_mensal").select("user_id, custo_tokens_openai, custo_storage").eq("mes_ano", `${mes}-01`).in("user_id", ids),
      supabaseAdmin.from("planos").select("id, nome, limite_mensagens_mes, limite_storage_mb, preco_mensal"),
      supabaseAdmin.from("config_alertas").select("custo_storage_mb_brl").eq("id", 1).maybeSingle(),
    ]);

    const planosById = Object.fromEntries((planos ?? []).map((p) => [p.id, p]));
    const subsByUser = Object.fromEntries((subs ?? []).map((s) => [s.user_id, s]));
    const usoByUser = Object.fromEntries((usos ?? []).map((u) => [u.user_id, u]));
    const custoByUser = Object.fromEntries((custos ?? []).map((c) => [c.user_id, c]));
    const rateMb = Number(cfg?.custo_storage_mb_brl ?? 0.0001);

    const rows = [];
    for (const p of profiles ?? []) {
      const sub = subsByUser[p.id];
      const plano = sub?.plano_id ? planosById[sub.plano_id] : undefined;
      const u = usoByUser[p.id];
      const c = custoByUser[p.id];
      const { data: bytes } = await supabaseAdmin.rpc("storage_bytes_by_user", { _user_id: p.id });
      const mb = Number(bytes ?? 0) / 1048576;
      const custoStorage = Number(c?.custo_storage ?? mb * rateMb);
      const custoIA = Number(c?.custo_tokens_openai ?? u?.custo_estimado_brl ?? 0);
      const msgs = u?.total_mensagens ?? 0;
      const limMsgs = plano?.limite_mensagens_mes ?? null;
      const limMb = plano?.limite_storage_mb ?? null;
      // Estimativa de créditos Lovable AI Gateway (~R$ 0,05 / crédito).
      const CREDITO_BRL = 0.05;
      const creditosLovable = custoIA / CREDITO_BRL;
      rows.push({
        user_id: p.id,
        nome: p.nome,
        email: p.email,
        plano_nome: plano?.nome ?? "Trial",
        plano_id: sub?.plano_id ?? null,
        status: sub?.status ?? "trialing",
        mensagens: msgs,
        tokens: u?.total_tokens ?? 0,
        storage_mb: mb,
        custo_ia_brl: custoIA,
        custo_storage_brl: custoStorage,
        custo_total_brl: custoIA + custoStorage,
        creditos_lovable: creditosLovable,
        limite_mensagens: limMsgs,
        limite_storage_mb: limMb,
        pct_mensagens: limMsgs ? (msgs / limMsgs) * 100 : null,
        pct_storage: limMb ? (mb / limMb) * 100 : null,
      });
    }
    rows.sort((a, b) => b.custo_total_brl - a.custo_total_brl);
    return rows;
  });

export const getUsoHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("uso_mensal")
      .select("mes_ano, total_mensagens, total_tokens, custo_estimado_brl")
      .eq("user_id", data.userId)
      .order("mes_ano", { ascending: false })
      .limit(6);
    return rows ?? [];
  });

export const refreshCustosMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { primeiroDia } = mesAtual();
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id").limit(1000);
    for (const p of profiles ?? []) {
      await supabaseAdmin.rpc("refresh_custos_cliente_mensal", { _user_id: p.id, _mes_ano: primeiroDia });
      await supabaseAdmin.rpc("check_alertas_uso", { _user_id: p.id });
    }
    return { ok: true, total: profiles?.length ?? 0 };
  });

export const listAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mes } = mesAtual();
    const { data } = await supabaseAdmin
      .from("alertas_uso")
      .select("id, user_id, mes_ano, tipo, threshold_pct, percentual_atingido, disparado_em, notificou_admin, notificou_usuario")
      .eq("mes_ano", mes)
      .order("disparado_em", { ascending: false })
      .limit(200);
    const ids = Array.from(new Set((data ?? []).map((a) => a.user_id)));
    let nomes: Record<string, { nome: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: p } = await supabaseAdmin.from("profiles").select("id, nome, email").in("id", ids);
      nomes = Object.fromEntries((p ?? []).map((x) => [x.id, { nome: x.nome, email: x.email }]));
    }
    return (data ?? []).map((r) => ({ ...r, profile: nomes[r.user_id] ?? null }));
  });

export const getConfigAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("config_alertas").select("*").eq("id", 1).maybeSingle();
    return data ?? { thresholds: [50, 80, 100], notificar_admin: true, notificar_usuarios: false, custo_storage_mb_brl: 0.0001 };
  });

export const updateConfigAlertas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        thresholds: z.array(z.number().int().min(1).max(500)).min(1).max(6),
        notificar_admin: z.boolean(),
        notificar_usuarios: z.boolean(),
        custo_storage_mb_brl: z.number().min(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("config_alertas")
      .update({
        thresholds: data.thresholds,
        notificar_admin: data.notificar_admin,
        notificar_usuarios: data.notificar_usuarios,
        custo_storage_mb_brl: data.custo_storage_mb_brl,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const countAlertasPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mes } = mesAtual();
    const { count } = await supabaseAdmin
      .from("alertas_uso")
      .select("id", { count: "exact", head: true })
      .eq("mes_ano", mes)
      .eq("notificou_admin", false);
    return { count: count ?? 0 };
  });