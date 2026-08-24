import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { SELECT_ASSEMBLEIA_ALIASES, paraColunasDb } from "./colunas";

export const listAssembleias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    condominioId: z.string(),
    situacao: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    let query = supabase
      .from("assembleias")
      .select(`
        *,
        ${SELECT_ASSEMBLEIA_ALIASES},
        itens_count:assembleia_itens(count)
      `)
      .eq("condominio_id", data.condominioId)
      .order("data_hora", { ascending: false });

    if (data.situacao) {
      query = query.eq("situacao", data.situacao);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      ...r,
      itens_count: r.itens_count?.[0]?.count || 0
    }));
  });

export const getIndicadoresAssembleias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ condominioId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const [emAndamento, convocadas] = await Promise.all([
      supabase.from("assembleias").select("id", { count: "exact" }).eq("condominio_id", data.condominioId).eq("situacao", "ao_vivo"),
      supabase.from("assembleias").select("data_hora").eq("condominio_id", data.condominioId).eq("situacao", "convocada").order("data_hora", { ascending: true }).limit(1)
    ]);

    return {
      emAndamento: emAndamento.count || 0,
      proximaEmDias: convocadas.data?.[0] 
        ? Math.max(0, Math.ceil((new Date(convocadas.data[0].data_hora).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null
    };
  });


export const getAssembleia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: assembleia, error } = await supabase
      .from("assembleias")
      .select(`
        *,
        ${SELECT_ASSEMBLEIA_ALIASES},
        itens:assembleia_itens(
          *,
          opcoes:assembleia_opcoes(*)
        )
      `)
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);
    return assembleia;
  });

const regrasSchema = {
  base_calculo_padrao: z.string().optional(),
  quorum_instalacao_1: z.string().optional(),
  quorum_instalacao_2: z.string().nullable().optional(),
  bloqueio_inadimplente: z.boolean().optional(),
  limite_procuracoes: z.number().nullable().optional(),
  voto_pela_mesa: z.boolean().optional(),
};

export const createAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    condominio_id: z.string(),
    titulo: z.string().min(5),
    tipo: z.string(),
    data_inicio: z.string(),
    local: z.string().optional(),
    modalidade: z.enum(["presencial", "virtual", "hibrida"]),
    link_videoconferencia: z.string().url().optional().or(z.literal("")),
    convocacao_numero: z.number().optional().default(1),
    ...regrasSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    // Gerar codigo_publico (8 chars, sem 0, 1, O, I, L)
    const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let codigo = "";
    for (let i = 0; i < 8; i++) codigo += charset.charAt(Math.floor(Math.random() * charset.length));

    const { data: row, error } = await supabase
      .from("assembleias")
      .insert({
        ...paraColunasDb(data),
        codigo_publico: codigo,
        situacao: "rascunho",
        criado_por: userId
      })
      .select(`*, ${SELECT_ASSEMBLEIA_ALIASES}`)
      .single();

    if (error) throw new Error(error.message);

    // Auditoria
    const { logAdminAction } = await import("@/lib/audit.server");
    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.create",
      targetCondominioId: data.condominio_id,
      metadata: { assembleia_id: row.id }
    });

    return row;
  });

export const updateAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string(),
    titulo: z.string().min(5).optional(),
    tipo: z.string().optional(),
    data_inicio: z.string().optional(),
    local: z.string().optional(),
    modalidade: z.enum(["presencial", "virtual", "hibrida"]).optional(),
    link_videoconferencia: z.string().url().optional().or(z.literal("")),
    convocacao_numero: z.number().optional(),
    situacao: z.string().optional(),
    ...regrasSchema,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { id, ...updateData } = data;
    const { data: row, error } = await supabase
      .from("assembleias")
      .update(paraColunasDb(updateData))
      .eq("id", id)
      .select(`*, ${SELECT_ASSEMBLEIA_ALIASES}`)
      .single();

    if (error) throw new Error(error.message);


    const { logAdminAction } = await import("@/lib/audit.server");
    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.update",
      targetCondominioId: row.condominio_id,
      metadata: { assembleia_id: id }
    });

    return row;
  });

export const cancelarAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    id: z.string(),
    motivo: z.string().optional()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: row, error } = await supabase
      .from("assembleias")
      .update({ situacao: "cancelada" })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { logAdminAction } = await import("@/lib/audit.server");
    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.cancel",
      targetCondominioId: row.condominio_id,
      metadata: { assembleia_id: data.id, motivo: data.motivo }
    });

    return row;
  });

export const listCondominiosParaAssembleias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data, error } = await supabase
      .from("condominios")
      .select("id, nome, cidade, uf")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });
