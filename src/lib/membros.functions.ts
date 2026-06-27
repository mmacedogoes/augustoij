import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMembros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("condominio_members")
      .select("id, user_id, papel, created_at")
      .eq("condominio_id", data.condominioId);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((m) => ({
      ...m,
      nome: byId.get(m.user_id)?.nome ?? null,
      email: byId.get(m.user_id)?.email ?? null,
    }));
  });

export const inviteMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        email: z.string().email().max(255),
        papel: z.enum(["dono_condominio", "operador_condominio"]).default("operador_condominio"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verifica se o chamador é dono do condomínio
    const { data: condo } = await context.supabase
      .from("condominios")
      .select("owner_id")
      .eq("id", data.condominioId)
      .maybeSingle();
    if (!condo || condo.owner_id !== context.userId) {
      throw new Error("Apenas o dono do condomínio pode convidar membros.");
    }
    const emailNorm = data.email.toLowerCase().trim();
    const { data: target } = await context.supabase
      .from("profiles")
      .select("id")
      .ilike("email", emailNorm)
      .maybeSingle();
    if (!target) {
      throw new Error("Nenhum usuário cadastrado com este e-mail. Peça para ele criar conta primeiro.");
    }
    const { error } = await context.supabase
      .from("condominio_members")
      .insert({ condominio_id: data.condominioId, user_id: target.id, papel: data.papel });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("condominio_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });