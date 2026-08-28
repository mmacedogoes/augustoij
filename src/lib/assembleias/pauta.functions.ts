import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";

export const upsertItemPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().optional(),
    assembleia_id: z.string(),
    titulo: z.string().min(3),
    descricao: z.string().optional(),
    ordem: z.number(),
    tipo_votacao: z.enum(["sim_nao_abstencao", "escolha_unica"]),
    voto_secreto: z.boolean().default(false),
    regra_quorum: z.string(),
    quorum_valor: z.number().min(0).max(1).nullish(),
    base_calculo: z.string(),
    opcoes: z.array(z.object({
      rotulo: z.string(),
      descricao: z.string().optional(),
      natureza: z.string().optional(),
      ordem: z.number()
    })).optional()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    // Validar opções se escolha_unica
    if (data.tipo_votacao === "escolha_unica" && (!data.opcoes || data.opcoes.length < 2)) {
      throw new Error("Itens de escolha única precisam de pelo menos duas opções.");
    }

    const { opcoes, id, voto_secreto, base_calculo, regra_quorum, ...itemData } = data;

    const BASES: Record<string, string> = {
      voto_por_unidade: "unidade",
      por_unidade: "unidade",
      unidade: "unidade",
      fracao: "fracao_ideal",
      fracao_ideal: "fracao_ideal",
    };
    const QUORUNS = new Set([
      "maioria_simples_presentes",
      "maioria_absoluta_condominos",
      "dois_tercos_presentes",
      "dois_tercos_condominos",
      "tres_quartos_condominos",
      "unanimidade",
      "personalizado",
    ]);
    const REGRAS: Record<string, string> = {
      maioria_simples: "maioria_simples_presentes",
      maioria_unidades: "maioria_simples_presentes",
      metade_mais_um: "maioria_absoluta_condominos",
      maioria_absoluta: "maioria_absoluta_condominos",
      maioria_condominos: "maioria_absoluta_condominos",
      dois_tercos: "dois_tercos_condominos",
      tres_quartos: "tres_quartos_condominos",
      qualquer_numero: "maioria_simples_presentes",
    };
    const regra = QUORUNS.has(regra_quorum)
      ? regra_quorum
      : (REGRAS[regra_quorum] ?? "maioria_simples_presentes");

    const payload: Record<string, unknown> = {
      ...itemData,
      secreto: voto_secreto ?? false,
      base_calculo: BASES[base_calculo] ?? "unidade",
      regra_quorum: regra,
    };
    if (regra === "personalizado" && payload.quorum_valor == null) {
      payload.quorum_valor = 0.5;
    }
    if (id) payload.id = id;

    const { data: row, error } = await supabase
      .from("assembleia_itens")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Se sim_nao_abstencao, criar opções automaticamente
    if (data.tipo_votacao === "sim_nao_abstencao") {
      await supabase.from("assembleia_opcoes").delete().eq("item_id", row.id);
      await supabase.from("assembleia_opcoes").insert([
        { item_id: row.id, rotulo: "Sim", natureza: "favoravel", ordem: 1 },
        { item_id: row.id, rotulo: "Não", natureza: "contraria", ordem: 2 },
        { item_id: row.id, rotulo: "Abstenção", natureza: "abstencao", ordem: 3 },
      ]);
    } else if (opcoes) {
      await supabase.from("assembleia_opcoes").delete().eq("item_id", row.id);
      await supabase.from("assembleia_opcoes").insert(
        opcoes.map(o => ({ ...o, item_id: row.id }))
      );
    }

    // Auditoria
    const { logAdminAction } = await import("@/lib/audit.server");
    const { data: ass } = await supabase.from("assembleias").select("condominio_id").eq("id", row.assembleia_id).single();
    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.pauta.update",
      targetCondominioId: ass?.condominio_id,
      metadata: { assembleia_id: row.assembleia_id, item_id: row.id }
    });

    return row;
  });

export const reordenarItens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    assembleiaId: z.string(),
    ordens: z.array(z.object({ id: z.string(), ordem: z.number() }))
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { error } = await supabase
      .from("assembleia_itens")
      .upsert(data.ordens.map(o => ({ id: o.id, ordem: o.ordem, assembleia_id: data.assembleiaId })));

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteItemPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });
    
    const { error } = await supabase.from("assembleia_itens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
