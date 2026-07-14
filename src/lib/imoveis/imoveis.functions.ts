import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { imovelSchema, idInput } from "./schemas";

export const listImoveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("imoveis")
      .select("id, descricao, endereco, edificio, numero_unidade, cidade, uf, proprietario_id, proprietarios(nome)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const getImovel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("imoveis")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Imóvel não encontrado");
    return row;
  });

export const upsertImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => imovelSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const payload = { ...data, owner_admin_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("imoveis")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("imoveis")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const removeImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("imoveis")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });