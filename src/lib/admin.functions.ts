import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";
import { PLAN_IDS, PLANS, type PlanId } from "@/config/plans";

const PlanoConfigEnum = z.enum(PLAN_IDS as [PlanId, ...PlanId[]]);

/** Captura IP + UA da requisição atual para a trilha de auditoria. */
function getAuditContext(): { ip: string | null; ua: string | null } {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    ip = null;
  }
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {
    ua = null;
  }
  return { ip, ua };
}

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
  };
  condominios: Array<{ id: string; nome: string; uf: string | null; qtd_unidades: number | null; created_at: string }>;
  usoMes: { mensagens: number; tokens: number; custo_brl: number; mes_ano: string };
  financeiro: { total_mensagens_historico: number; custo_estimado_total_brl: number };
};

export const getUsuarioDetalheAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<UsuarioDetalhe> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const mesAno = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    const [profRes, subRes, condosRes, usoMesRes, historicoRes] = await Promise.all([
      supabaseAdmin.from("profiles").select(
        "id, nome, email, telefone, oab, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, perfil_atuacao, ativo, created_at, ultimo_acesso",
      ).eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("subscriptions").select(
        "plano_config_id, cortesia, cortesia_observacao, status, trial_end, current_period_end, creditos_mensagens_extras",
      ).eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("condominios").select("id, nome, uf, qtd_unidades, created_at").eq("owner_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("uso_mensal").select("total_mensagens, total_tokens, custo_estimado_brl").eq("user_id", data.userId).eq("mes_ano", mesAno).maybeSingle(),
      supabaseAdmin.from("uso_mensal").select("total_mensagens, custo_estimado_brl").eq("user_id", data.userId),
    ]);

    if (profRes.error || !profRes.data) throw new Error("Usuário não encontrado");

    const rawPlano = (subRes.data?.plano_config_id ?? "personalizado") as string;
    const planoConfigId = (rawPlano in PLANS ? rawPlano : "personalizado") as PlanId;
    const historico = historicoRes.data ?? [];

    return {
      profile: profRes.data,
      subscription: {
        plano_config_id: planoConfigId,
        cortesia: subRes.data?.cortesia ?? true,
        cortesia_observacao: subRes.data?.cortesia_observacao ?? null,
        status: subRes.data?.status ?? "active",
        trial_end: subRes.data?.trial_end ?? null,
        current_period_end: subRes.data?.current_period_end ?? null,
        creditos_mensagens_extras: subRes.data?.creditos_mensagens_extras ?? 0,
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

    const { ip, ua } = getAuditContext();
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "subscription.update",
      target_user_id: data.userId,
      metadata: patch,
      ip_address: ip,
      user_agent: ua,
    });

    return { ok: true };
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
    return rows ?? [];
  });

export const listCondominiosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("condominios")
      .select("id, nome, uf, qtd_unidades, owner_id, created_at")
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

    const { ip, ua } = getAuditContext();
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "role.set",
      target_user_id: data.userId,
      metadata: { papel: data.papel },
      ip_address: ip,
      user_agent: ua,
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

    const { ip, ua } = getAuditContext();
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "user.create",
      target_user_id: newUserId,
      metadata: {
        email: data.email,
        papel: data.papel,
        perfil: data.perfil_atuacao ?? null,
        plano_config_id: planoConfigId,
        cortesia,
      },
      ip_address: ip,
      user_agent: ua,
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

    const { ip, ua } = getAuditContext();
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: data.ativo ? "user.activate" : "user.deactivate",
      target_user_id: data.userId,
      metadata: { ativo: data.ativo },
      ip_address: ip,
      user_agent: ua,
    });

    return { ok: true };
  });