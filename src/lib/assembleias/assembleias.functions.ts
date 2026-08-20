import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";

export const listAssembleias = createServerFn({ method: "GET" })
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
        itens_count:assembleia_itens(count)
      `)
      .eq("condominio_id", data.condominioId)
      .order("data_inicio", { ascending: false });

    if (data.situacao) {
      query = query.eq("situacao", data.situacao);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return rows.map((r: any) => ({
      ...r,
      itens_count: r.itens_count[0]?.count || 0
    }));
  });

export const getIndicadoresAssembleias = createServerFn({ method: "GET" })
  .inputValidator(z.object({ condominioId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const [emAndamento, convocadas] = await Promise.all([
      supabase.from("assembleias").select("id", { count: "exact" }).eq("condominio_id", data.condominioId).eq("situacao", "ao_vivo"),
      supabase.from("assembleias").select("data_inicio").eq("condominio_id", data.condominioId).eq("situacao", "convocada").order("data_inicio", { ascending: true }).limit(1)
    ]);

    return {
      emAndamento: emAndamento.count || 0,
      proximaEmDias: convocadas.data?.[0] 
        ? Math.max(0, Math.ceil((new Date(convocadas.data[0].data_inicio).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null
    };
  });

export const getAssembleia = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: assembleia, error } = await supabase
      .from("assembleias")
      .select(`
        *,
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

export const createAssembleia = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    condominio_id: z.string(),
    titulo: z.string().min(5),
    tipo: z.string(),
    data_inicio: z.string(),
    local: z.string().optional(),
    modalidade: z.enum(["presencial", "virtual", "hibrida"]),
    link_videoconferencia: z.string().url().optional().or(z.literal("")),
    convocacao_numero: z.number().optional().default(1),
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
        ...data,
        codigo_publico: codigo,
        situacao: "rascunho",
        criado_por: userId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Auditoria
    const { logAdminAction } = await import("@/lib/contratos-servico/auditoria.server");
    await logAdminAction(supabase, userId, "assembleia.create", { 
      assembleia_id: row.id,
      condominio_id: data.condominio_id 
    }, data.condominio_id);

    return row;
  });
