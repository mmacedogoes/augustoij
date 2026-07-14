import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { proprietarioSchema, idInput } from "./schemas";

export const listProprietarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("proprietarios")
      .select("id, nome, cpf, email, telefone, created_at")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const getProprietario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("proprietarios")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Proprietário não encontrado");
    return row;
  });

export const upsertProprietario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => proprietarioSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const payload = { ...data, owner_admin_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("proprietarios")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("proprietarios")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const removeProprietario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("proprietarios")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });