import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

const responsavelEnum = z.enum(["proprietario", "inquilino", "administrador", "condominio"]);
const statusEnum = z.enum(["solicitada", "em_andamento", "concluida", "cancelada"]);

const manutencaoSchema = z.object({
  id: z.string().uuid().optional(),
  imovel_id: z.string().uuid(),
  titulo: z.string().trim().min(1, "Título é obrigatório").max(200),
  descricao: z.string().nullable().optional(),
  responsavel: responsavelEnum.default("proprietario"),
  status: statusEnum.default("solicitada"),
  custo_estimado: z.number().nullable().optional(),
  custo_final: z.number().nullable().optional(),
  data_solicitacao: z.string().min(10),
  data_conclusao: z.string().nullable().optional(),
});

export const listManutencoesPorImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ imovelId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("manutencoes")
      .select("*")
      .eq("imovel_id", data.imovelId)
      .order("data_solicitacao", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => manutencaoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const payload = { ...data, owner_admin_id: context.userId };
    if (data.id) {
      const { id, ...patch } = payload;
      if (!id) throw new Error("ID inválido");
      const { error } = await context.supabase.from("manutencoes").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("manutencoes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const removeManutencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase.from("manutencoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });