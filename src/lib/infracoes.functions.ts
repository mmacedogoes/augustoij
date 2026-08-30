import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TipoInfracao = z.enum(["notificacao", "advertencia", "multa", "comunicado"]);

export const listInfracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { condominioId: string; unidadeId?: string | null }) =>
    z
      .object({
        condominioId: z.string().uuid(),
        unidadeId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("unidade_infracoes")
      .select("*, unidades(bloco, numero), condominos(nome, cpf)")
      .eq("condominio_id", data.condominioId)
      .order("created_at", { ascending: false });
    if (data.unidadeId) query = query.eq("unidade_id", data.unidadeId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const InfracaoInput = z.object({
  condominioId: z.string().uuid(),
  unidadeId: z.string().uuid(),
  condominoId: z.string().uuid().nullish(),
  tipo: TipoInfracao.default("notificacao"),
  categoria: z.string().trim().min(2).max(160),
  descricao: z.string().trim().max(4000).nullish(),
  ocorrido_em: z.string().nullish(),
  base_normativa: z.string().trim().max(500).nullish(),
  valor_multa: z.number().nullish(),
  conversa_id: z.string().uuid().nullish(),
  documento_titulo: z.string().trim().max(300).nullish(),
});

export const registrarInfracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InfracaoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("unidade_infracoes")
      .insert({
        condominio_id: data.condominioId,
        unidade_id: data.unidadeId,
        condomino_id: data.condominoId ?? null,
        tipo: data.tipo,
        categoria: data.categoria,
        descricao: data.descricao ?? null,
        ocorrido_em: data.ocorrido_em ?? null,
        base_normativa: data.base_normativa ?? null,
        valor_multa: data.valor_multa ?? null,
        conversa_id: data.conversa_id ?? null,
        documento_titulo: data.documento_titulo ?? null,
        registrado_por: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const excluirInfracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("unidade_infracoes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Histórico resumido de uma unidade para checar reincidência antes de redigir
 * uma nova peça.
 */
export const historicoUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unidadeId: string; categoria?: string | null }) =>
    z
      .object({
        unidadeId: z.string().uuid(),
        categoria: z.string().trim().max(160).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("unidade_infracoes")
      .select("id, tipo, categoria, ocorrido_em, created_at, valor_multa, base_normativa")
      .eq("unidade_id", data.unidadeId)
      .order("created_at", { ascending: false });
    if (data.categoria) query = query.ilike("categoria", `%${data.categoria}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { total: rows?.length ?? 0, ocorrencias: rows ?? [] };
  });
