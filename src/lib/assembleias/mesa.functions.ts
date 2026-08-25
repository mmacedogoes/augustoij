import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./habilitacao.functions";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "../audit.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Busca progresso de votos sem ler votos individuais (proteção de sigilo)
export const getProgressoItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid(), segundos: z.number() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
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

export const anularEReabrirItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ 
    itemId: z.string().uuid(), 
    motivo: z.string().min(20) 
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: item } = await supabaseAdmin
      .from("assembleia_itens")
      .select("*, assembleias!inner(*)")
      .eq("id", input.itemId)
      .single();

    if (!item) throw new Error("Item não encontrado.");
    const assembleia = item.assembleias as any;

    // 1. Invalidar votos existentes
    await supabaseAdmin
      .from("assembleia_votos")
      .update({
        invalidado_em: new Date().toISOString(),
        invalidado_motivo: input.motivo,
        invalidado_por: context.userId
      })
      .eq("item_id", input.itemId);

    // 2. Limpar controle se for secreto
    if (item.secreto) {
      await supabaseAdmin
        .from("assembleia_votos_controle")
        .delete()
        .eq("item_id", input.itemId);
    }

    // 3. Remover resultado
    await supabaseAdmin
      .from("assembleia_resultados")
      .delete()
      .eq("item_id", input.itemId);

    // 4. Registrar na trilha e tentativas
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.item.anular",
      metadata: { item_id: input.itemId, motivo: input.motivo }
    });

    await supabaseAdmin.from("assembleia_tentativas").insert({
      assembleia_id: assembleia.id,
      item_id: input.itemId,
      motivo: `voto_anulado_pela_mesa: ${input.motivo}`
    } as any);

    // 5. Devolver para pendente
    await supabaseAdmin
      .from("assembleia_itens")
      .update({
        situacao: "pendente",
        aberto_em: null,
        encerrado_em: null,
        fecha_em: null
      })
      .eq("id", input.itemId);

    return { success: true };
  });

export const registrarVotoMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    unidadeId: z.string().uuid(),
    opcaoId: z.string().uuid(),
    justificativa: z.string().min(10)
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: item } = await supabaseAdmin
      .from("assembleia_itens")
      .select("*, assembleias!inner(*)")
      .eq("id", input.itemId)
      .single();

    if (!item) throw new Error("Item não encontrado.");
    const assembleia = item.assembleias as any;

    if (!assembleia?.permite_voto_manual_mesa) {
      throw new Error("Voto manual pela mesa não permitido nesta assembleia.");
    }

    if (item.secreto) {
      throw new Error("Não é permitido lançar voto manual em item secreto. Use o modo Cabine.");
    }

    const { data: hab } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("*")
      .eq("unidade_id", input.unidadeId)
      .eq("assembleia_id", assembleia.id)
      .single();
    
    if (!hab || !hab.apta) throw new Error("Unidade não habilitada.");

    const { data: recibo, error } = await supabaseAdmin.rpc('assembleia_registrar_voto', {
      p_item_id: input.itemId,
      p_unidade_id: input.unidadeId,
      p_opcao_id: input.opcaoId,
      p_peso: hab.peso_unidade,
      p_base_calculo: (item.base_calculo as any) || 'unidades',
      p_origem: 'manual_mesa',
      p_ip: '127.0.0.1',
      p_user_agent: 'Mesa Administrativa',
      p_device_hash: 'manual',
      p_lancado_por: context.userId,
      p_justificativa: input.justificativa
    });

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.voto.mesa",
      metadata: { item_id: input.itemId, unidade_id: input.unidadeId }
    });

    return { recibo };
  });

export const exibirResultadoParcial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: votos } = await supabaseAdmin
      .from("assembleia_votos")
      .select("opcao_id, peso")
      .eq("item_id", input.itemId)
      .is("invalidado_em", null);

    const mapaVotos: Record<string, number> = {};
    votos?.forEach(v => {
      mapaVotos[v.opcao_id] = (mapaVotos[v.opcao_id] || 0) + Number(v.peso);
    });

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.item.exibir_parcial",
      metadata: { item_id: input.itemId }
    });

    return { mapaVotos };
  });

export const abrirCabine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    unidadeId: z.string().uuid()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    // Validações
    const { data: item } = await supabaseAdmin
      .from("assembleia_itens")
      .select("situacao, assembleia_id")
      .eq("id", input.itemId)
      .single();

    if (item?.situacao !== 'aberto') throw new Error("Item não está aberto.");

    const { data: hab } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("apta")
      .eq("unidade_id", input.unidadeId)
      .eq("assembleia_id", item.assembleia_id)
      .single();

    if (!hab?.apta) throw new Error("Unidade não habilitada.");

    const { count: jaVotou } = await supabaseAdmin
      .from("assembleia_votos")
      .select("*", { count: 'exact', head: true })
      .eq("item_id", input.itemId)
      .eq("unidade_id", input.unidadeId)
      .is("invalidado_em", null);

    if (jaVotou && jaVotou > 0) throw new Error("Unidade já votou neste item.");

    const token = crypto.randomUUID();
    const hash = token; // Simplificado para a fase, ideal seria SHA-256
    
    await supabaseAdmin.from("assembleia_cabine_tokens").insert({
      item_id: input.itemId,
      unidade_id: input.unidadeId,
      token_hash: hash,
      expira_em: new Date(Date.now() + 120 * 1000).toISOString(),
      criado_por: context.userId
    });

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.cabine.abrir",
      metadata: { item_id: input.itemId, unidade_id: input.unidadeId }
    });

    return { url: `/cabine/${token}` };
  });

// Instala (abre oficialmente) a assembleia: pré-requisito para abrir votações
export const instalarAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assembleiaId: z.string().uuid() }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: assembleia, error: errGet } = await supabaseAdmin
      .from("assembleias")
      .select("id, condominio_id, instalada_em, situacao")
      .eq("id", input.assembleiaId)
      .single();

    if (errGet || !assembleia) throw new Error("Assembleia não encontrada.");
    if (assembleia.situacao === "cancelada") throw new Error("Assembleia cancelada.");
    if (assembleia.instalada_em) return { success: true, instalada_em: assembleia.instalada_em };

    const { count: aptos } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("*", { count: "exact", head: true })
      .eq("assembleia_id", input.assembleiaId)
      .eq("apta", true);

    if (!aptos) throw new Error("Conclua a habilitação das unidades antes de instalar a assembleia.");

    const instaladaEm = new Date().toISOString();
    const { error: errUpd } = await supabaseAdmin
      .from("assembleias")
      .update({ instalada_em: instaladaEm, situacao: "ao_vivo" })
      .eq("id", input.assembleiaId);

    if (errUpd) throw new Error(errUpd.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.instalar",
      targetCondominioId: assembleia.condominio_id,
      metadata: { assembleia_id: input.assembleiaId, aptos },
    });

    return { success: true, instalada_em: instaladaEm };
  });
