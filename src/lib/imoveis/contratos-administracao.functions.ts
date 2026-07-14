import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { contratoAdministracaoSchema, idInput } from "./schemas";

export const listContratosAdministracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("contratos_administracao")
      .select(
        "id, administrador_nome, percent_honorario_mensal, status, data_inicio, proprietario_id, proprietarios(nome)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const getContratoAdministracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("contratos_administracao")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Contrato não encontrado");
    return row;
  });

export const upsertContratoAdministracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => contratoAdministracaoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const payload = { ...data, owner_admin_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("contratos_administracao")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("contratos_administracao")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const removeContratoAdministracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("contratos_administracao")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });