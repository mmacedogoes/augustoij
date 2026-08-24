import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./habilitacao.functions";

// Funções públicas da Cabine: o acesso é autorizado exclusivamente pelo token
// de uso único gerado pela mesa (abrirCabine). Nenhuma sessão de usuário é exigida.

async function carregarToken(token: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("assembleia_cabine_tokens")
    .select("*")
    .eq("token_hash", token)
    .is("usado_em", null)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();
  return { supabaseAdmin, tokenRow: data };
}

export const validarTokenCabine = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data: input }) => {
    const { supabaseAdmin, tokenRow } = await carregarToken(input.token);
    if (!tokenRow) return { valido: false as const };

    const { data: item } = await supabaseAdmin
      .from("assembleia_itens")
      .select("id, titulo, situacao, secreto, base_calculo, assembleia_id, assembleia_opcoes(id, rotulo, descricao, ordem)")
      .eq("id", tokenRow.item_id)
      .single();

    if (!item || item.situacao !== "aberto") return { valido: false as const };

    return {
      valido: true as const,
      unidadeId: tokenRow.unidade_id,
      item: {
        id: item.id,
        titulo: item.titulo,
        opcoes: ((item as any).assembleia_opcoes || []).sort((a: any, b: any) => a.ordem - b.ordem),
      },
    };
  });

export const registrarVotoCabine = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10),
    opcaoId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data: input }) => {
    const { supabaseAdmin, tokenRow } = await carregarToken(input.token);
    if (!tokenRow) throw new Error("Token inválido ou expirado.");

    const { data: item } = await supabaseAdmin
      .from("assembleia_itens")
      .select("id, situacao, base_calculo, assembleia_id")
      .eq("id", tokenRow.item_id)
      .single();

    if (!item || item.situacao !== "aberto") throw new Error("Item não está aberto para votação.");

    // A opção precisa pertencer ao item
    const { count: opcaoValida } = await supabaseAdmin
      .from("assembleia_opcoes")
      .select("*", { count: "exact", head: true })
      .eq("id", input.opcaoId)
      .eq("item_id", item.id);

    if (!opcaoValida) throw new Error("Opção inválida para este item.");

    const { data: hab } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("apta, peso_unidade")
      .eq("unidade_id", tokenRow.unidade_id)
      .eq("assembleia_id", item.assembleia_id)
      .single();

    if (!hab?.apta) throw new Error("Unidade não habilitada.");

    const { count: jaVotou } = await supabaseAdmin
      .from("assembleia_votos")
      .select("*", { count: "exact", head: true })
      .eq("item_id", item.id)
      .eq("unidade_id", tokenRow.unidade_id)
      .is("invalidado_em", null);

    if (jaVotou && jaVotou > 0) throw new Error("Unidade já votou neste item.");

    const { data: recibo, error } = await supabaseAdmin.rpc("assembleia_registrar_voto", {
      p_item_id: item.id,
      p_unidade_id: tokenRow.unidade_id,
      p_opcao_id: input.opcaoId,
      p_peso: hab.peso_unidade,
      p_base_calculo: (item.base_calculo as any) || "unidades",
      p_origem: "cabine_mesa",
      p_ip: "127.0.0.1",
      p_user_agent: "Cabine",
      p_device_hash: "cabine",
      p_lancado_por: tokenRow.criado_por,
      p_justificativa: null as any,
    });

    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("assembleia_cabine_tokens")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return { recibo };
  });
