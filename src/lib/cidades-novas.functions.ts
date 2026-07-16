import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "@/lib/imoveis/guard";
import { slugCidade } from "@/lib/cidades-cobertas";

export const listCidadesNovasAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("cidades_novas_alertas")
      .select("id, cidade, uf, slug, status, created_at, resolvida_em, owner_id, primeiro_condominio_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const countCidadesNovasPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await ensureSuperAdmin(context);
    } catch {
      return { count: 0 };
    }
    const { count } = await context.supabase
      .from("cidades_novas_alertas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    return { count: count ?? 0 };
  });

export const marcarCidadeResolvida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), cidade: z.string().min(2), uf: z.string().length(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const slug = slugCidade(data.cidade, data.uf);
    await context.supabase
      .from("cidades_cobertas")
      .upsert({ cidade: data.cidade, uf: data.uf.toUpperCase(), slug }, { onConflict: "slug" });
    const { error } = await context.supabase
      .from("cidades_novas_alertas")
      .update({ status: "resolvida", resolvida_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });