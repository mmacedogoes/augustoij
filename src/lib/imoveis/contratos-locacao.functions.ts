import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { contratoLocacaoSchema, idInput } from "./schemas";

export const listContratosLocacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("contratos_locacao")
      .select(
        "id, inquilino_nome, valor_aluguel, status, data_inicio_vigencia, imovel_id, imoveis(descricao, endereco, edificio, numero_unidade, proprietarios(nome))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const getContratoLocacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("contratos_locacao")
      .select("*, caucoes(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Contrato não encontrado");
    return row;
  });

export const upsertContratoLocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => contratoLocacaoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { caucao, id, ...contrato } = data;
    const payload = { ...contrato, owner_admin_id: context.userId };
    let contratoId = id;
    if (contratoId) {
      const { error } = await context.supabase
        .from("contratos_locacao")
        .update(payload)
        .eq("id", contratoId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("contratos_locacao")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      contratoId = inserted.id as string;
    }
    // Upsert da caução (chave única contrato_locacao_id).
    const caucaoPayload = {
      ...caucao,
      contrato_locacao_id: contratoId,
      owner_admin_id: context.userId,
    };
    const { error: eC } = await context.supabase
      .from("caucoes")
      .upsert(caucaoPayload, { onConflict: "contrato_locacao_id" });
    if (eC) throw new Error(eC.message);
    return { id: contratoId };
  });

export const removeContratoLocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("contratos_locacao")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });