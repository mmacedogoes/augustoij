import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

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

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase.rpc("admin_dashboard_metrics");
    if (error) throw new Error(error.message);
    return data as Record<string, number>;
  });

export const getUsageTimeseries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ days: z.number().int().min(1).max(180).default(30) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: rows, error } = await context.supabase.rpc("admin_usage_timeseries", { _days: data.days });
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
    const { data: rows, error } = await context.supabase.rpc("admin_list_users", {
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

    const { ip, ua } = getAuditContext();
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "user.create",
      target_user_id: newUserId,
      metadata: { email: data.email, papel: data.papel, perfil: data.perfil_atuacao ?? null },
      ip_address: ip,
      user_agent: ua,
    });

    return { ok: true, userId: newUserId };
  });