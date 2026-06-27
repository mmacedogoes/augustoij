import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

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

    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "role.set",
      target_user_id: data.userId,
      metadata: { papel: data.papel },
    });

    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("admin_audit_log")
      .select("id, actor_user_id, action, target_user_id, target_condominio_id, target_kb_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });