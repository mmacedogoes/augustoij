import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoAssembleias } from "./guard.server";
import { calcularQuorum } from "./quorum";

// Importação dinâmica para service_role
const getSupabaseAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

// --- Tipos e Schemas ---

const ResultadoSchema = z.object({
  total_aptos: z.number(),
  total_votantes: z.number(),
  mapa_votos: z.record(z.string(), z.number()),
  vencedora_opcao_id: z.string().uuid().nullable(),
  aprovado: z.boolean(),
  quorum_exigido: z.number(),
  quorum_atingido: z.number(),
  empate: z.boolean()
});

// --- Server Functions ---

export const abrirVotacaoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    duracaoSegundos: z.number().optional()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    // 1. Verificar assembleia e item
    const { data: item, error: errItem } = await supabaseAdmin
      .from("assembleia_itens")
      .select("*, assembleias!inner(*)")
      .eq("id", input.itemId)
      .single();

    if (errItem || !item) throw new Error("Item não encontrado.");
    const assembleia = item.assembleias as any;

    if (!assembleia.instalada_em) throw new Error("Assembleia não instalada.");
    if (item.situacao !== "pendente") throw new Error("Item não está pendente.");

    // 2. Garantir que não há outro item aberto
    const { count } = await supabaseAdmin
      .from("assembleia_itens")
      .select("*", { count: 'exact', head: true })
      .eq("assembleia_id", assembleia.id)
      .eq("situacao", "aberto");

    if (count && count > 0) throw new Error("Já existe um item com votação aberta.");

    // 3. Abrir votação
    const abertoEm = new Date().toISOString();
    const fechaEm = input.duracaoSegundos 
      ? new Date(Date.now() + input.duracaoSegundos * 1000).toISOString()
      : null;

    const { error: errUpdate } = await supabaseAdmin
      .from("assembleia_itens")
      .update({
        situacao: "aberto",
        aberto_em: abertoEm,
        fecha_em: fechaEm
      })
      .eq("id", input.itemId);

    if (errUpdate) throw new Error(errUpdate.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.item.abrir",
      targetCondominioId: assembleia.condominio_id,
      metadata: { item_id: input.itemId, assembleia_id: assembleia.id }
    });

    return { success: true };
  });

export const encerrarVotacaoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { error: errUpdate } = await supabaseAdmin
      .from("assembleia_itens")
      .update({
        situacao: "encerrado",
        encerrado_em: new Date().toISOString()
      })
      .eq("id", input.itemId);

    if (errUpdate) throw new Error(errUpdate.message);

    // Apuração automática
    const resultado = await apurarItemInterno(input.itemId);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.item.encerrar",
      metadata: { item_id: input.itemId }
    });

    return resultado;
  });

export const apurarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid()
  }).parse(d))
  .handler(async ({ data: input, context }) => {
    await ensureAcessoAssembleias(context);
    return await apurarItemInterno(input.itemId);
  });

async function apurarItemInterno(itemId: string) {
  const supabaseAdmin = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  // 1. Verificar se já existe resultado
  const { data: existente } = await supabaseAdmin
    .from("assembleia_resultados")
    .select("*")
    .eq("item_id", itemId)
    .maybeSingle();

  if (existente) return existente;

  // 2. Carregar item e quórum
  const { data: item } = await supabaseAdmin
    .from("assembleia_itens")
    .select("*, assembleias!inner(*)")
    .eq("id", itemId)
    .single();

  if (!item) throw new Error("Item não encontrado.");
  const assembleia = item.assembleias as any;

  // 3. Carregar votos
  const { data: votos } = await supabaseAdmin
    .from("assembleia_votos")
    .select("*")
    .eq("item_id", itemId)
    .eq("invalido", false);

  // 4. Carregar total de aptos (snapshot da habilitação)
  const { count: totalAptos } = await supabaseAdmin
    .from("assembleia_habilitacoes")
    .select("*", { count: 'exact', head: true })
    .eq("assembleia_id", assembleia.id)
    .eq("apta", true);

  const mapaVotos: Record<string, number> = {};
  votos?.forEach(v => {
    mapaVotos[v.opcao_id] = (mapaVotos[v.opcao_id] || 0) + Number(v.peso);
  });

  // Identificar vencedor e empate
  let vencedoraOpcaoId: string | null = null;
  let maxVotos = -1;
  let empate = false;

  Object.entries(mapaVotos).forEach(([id, peso]) => {
    if (peso > maxVotos) {
      maxVotos = peso;
      vencedoraOpcaoId = id;
      empate = false;
    } else if (peso === maxVotos) {
      empate = true;
      vencedoraOpcaoId = null;
    }
  });

  // Regra de quórum (simplificada para a fase)
  // Se for Sim/Não/Abstenção, o quórum geralmente é sobre o total de aptos ou presentes
  const { data: opcoes } = await supabaseAdmin.from("assembleia_opcoes").select("*").eq("item_id", itemId);
  const simOpcao = opcoes?.find(o => o.rotulo.toLowerCase() === 'sim');
  
  const votosFavoraveis = simOpcao ? (mapaVotos[simOpcao.id] || 0) : maxVotos;
  
  const resQuorum = calcularQuorum(votosFavoraveis, totalAptos || 0, {
    tipo: (item.tipo_quorum as any) || 'maioria_simples',
    base_calculo: (item.base_calculo as any) || 'unidades'
  });

  const resultadoData = {
    item_id: itemId,
    total_aptos: totalAptos || 0,
    total_votantes: votos?.length || 0,
    mapa_votos: mapaVotos,
    vencedora_opcao_id: vencedoraOpcaoId,
    aprovado: resQuorum.aprovado,
    quorum_exigido: resQuorum.quorum_exigido,
    quorum_atingido: resQuorum.quorum_atingido,
    empate: empate,
    hash_resultado: `RES-${Date.now()}` // Trigger deve gerar o real, aqui é fallback
  };

  const { data: novoResultado, error: errIns } = await supabaseAdmin
    .from("assembleia_resultados")
    .insert(resultadoData)
    .select()
    .single();

  if (errIns) throw new Error(errIns.message);

  await logAdminAction({
    actorUserId: '00000000-0000-0000-0000-000000000000', // Sistema
    action: "assembleia.item.apurar",
    metadata: { item_id: itemId, resultado_id: novoResultado.id }
  });

  return novoResultado;
}
