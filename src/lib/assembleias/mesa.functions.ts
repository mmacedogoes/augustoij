import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./habilitacao.functions";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "../audit.server";

// Busca progresso de votos sem ler votos individuais (proteção de sigilo)
export const getProgressoItem = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    if (!context?.userId || !context?.supabase) throw new Error("Não autorizado");
    await ensureAcessoAssembleias(context as any);
    const supabaseAdmin = await getSupabaseAdmin();

    // 1. Total de unidades aptas na assembleia
    const { data: item } = await supabaseAdmin
        .from("assembleia_itens")
        .select("assembleia_id")
        .eq("id", input.itemId)
        .single();
    
    if (!item) throw new Error("Item não encontrado.");

    const { count: totalAptos } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("*", { count: 'exact', head: true })
      .eq("assembleia_id", item.assembleia_id)
      .eq("apta", true);

    // 2. Total de votos registrados no item
    const { count: totalVotaram } = await supabaseAdmin
      .from("assembleia_votos")
      .select("*", { count: 'exact', head: true })
      .eq("item_id", input.itemId)
      .is("invalidado_em", null);

    const aptos = totalAptos || 0;
    const votaram = totalVotaram || 0;
    const percentual = aptos > 0 ? (votaram / aptos) * 100 : 0;

    return { totalAptos: aptos, totalVotaram: votaram, percentual };
  });

export const prorrogarVotacao = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ itemId: z.string().uuid(), segundos: z.number() }).parse(d))
  .handler(async ({ data: input, context }) => {
    if (!context?.userId || !context?.supabase) throw new Error("Não autorizado");
    await ensureAcessoAssembleias(context as any);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: item } = await supabaseAdmin
        .from("assembleia_itens")
        .select("fecha_em, situacao")
        .eq("id", input.itemId)
        .single();

    if (!item || item.situacao !== 'aberto') throw new Error("Votação não está aberta.");
    if (!item.fecha_em) throw new Error("Item sem cronômetro definido.");

    const novoFechaEm = new Date(new Date(item.fecha_em).getTime() + input.segundos * 1000).toISOString();

    await supabaseAdmin
        .from("assembleia_itens")
        .update({ fecha_em: novoFechaEm })
        .eq("id", input.itemId);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.item.prorrogar",
      metadata: { item_id: input.itemId, acrescimo_segundos: input.segundos }
    });

    return { success: true };
  });
