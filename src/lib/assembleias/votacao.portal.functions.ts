import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "./habilitacao.functions"; // Reuso do helper
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

// Função para buscar unidades representadas por uma sessão
export const listUnidadesVotante = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    // A validação do token/sessão deve acontecer aqui (via cookie que ainda implementaremos no Portal)
    // Por enquanto, rascunhamos a lógica de busca
    return [];
  });

export const registrarVoto = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    itemId: z.string().uuid(),
    unidadeId: z.string().uuid(),
    opcaoId: z.string().uuid()
  }))
  .handler(async ({ data: input, context }) => {
    const supabaseAdmin = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const ip = getRequestIP({ xForwardedFor: true }) || "127.0.0.1";
    const agent = getRequestHeader("user-agent") || "";

    // 1. Obter snapshot da unidade para o peso
    const { data: hab } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .select("*")
      .eq("unidade_id", input.unidadeId)
      .single();
    
    if (!hab || !hab.apta) throw new Error("unidade_nao_habilitada");

    // 2. Chamar a função do banco
    const { data: recibo, error } = await supabaseAdmin.rpc('assembleia_registrar_voto', {
      p_item_id: input.itemId,
      p_unidade_id: input.unidadeId,
      p_opcao_id: input.opcaoId,
      p_peso: hab.peso_unidade, // Simplificado: precisaria checar base do item
      p_base_calculo: 'unidades',
      p_origem: 'portal',
      p_ip: ip,
      p_user_agent: agent,
      p_device_hash: agent // Sinal fraco
    });

    if (error) {
      // Registrar tentativa
      await supabaseAdmin.from("assembleia_tentativas").insert({
        assembleia_id: hab.assembleia_id,
        item_id: input.itemId,
        unidade_id: input.unidadeId,
        motivo: error.message,
        ip: ip,
        user_agent: agent
      } as any);
      throw new Error(error.message);
    }

    return { recibo };
  });

export const getEstadoVotacao = createServerFn({ method: "GET" })
  .inputValidator(z.object({ codigoAssembleia: z.string() }))
  .handler(async ({ data: input }) => {
    const supabaseAdmin = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;

    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select(`
        *,
        itens:assembleia_itens(
          *,
          opcoes:assembleia_opcoes(*),
          resultados:assembleia_resultados(*)
        )
      `)
      .eq("codigo_publico", input.codigoAssembleia)
      .single();

    if (!assembleia) throw new Error("assembleia_nao_encontrada");

    return {
      instalada: !!assembleia.instalada_em,
      itens: assembleia.itens.map((it: any) => ({
        id: it.id,
        titulo: it.titulo,
        situacao: it.situacao,
        opcoes: it.opcoes,
        resultado: it.resultados?.[0] || null,
        fecha_em: it.fecha_em,
        secreto: it.secreto
      }))
    };
  });

// Conferência de recibo pelo condômino. Nunca devolve a unidade, em nenhuma hipótese.
export const conferirRecibo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    codigo: z.string().min(3),
    recibo: z.string().min(4).max(120)
  }).parse(d))
  .handler(async ({ data: input }) => {
    const supabaseAdmin = await (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { dentroDoLimite } = await import("./rate-limit.server");
    const ip = getRequestIP({ xForwardedFor: true }) || "127.0.0.1";

    const { data: assembleia } = await supabaseAdmin
      .from("assembleias")
      .select("id")
      .eq("codigo_publico", input.codigo)
      .single();

    if (!assembleia) return { encontrado: false as const };

    if (!dentroDoLimite(`recibo:${ip}`)) {
      await supabaseAdmin.from("assembleia_tentativas").insert({
        assembleia_id: assembleia.id,
        motivo: "rate_limit",
        detalhe: "conferencia_recibo",
        ip,
        user_agent: getRequestHeader("user-agent") || null
      } as any);
      throw new Error("rate_limit");
    }

    const { data: voto } = await supabaseAdmin
      .from("assembleia_votos")
      .select("recibo, invalidado_em, item:assembleia_itens(ordem, titulo, situacao), opcao:assembleia_opcoes(rotulo)")
      .eq("assembleia_id", assembleia.id)
      .eq("recibo", input.recibo.trim())
      .maybeSingle();

    const item: any = (voto as any)?.item;
    if (!voto || !item || !["encerrado", "apurado"].includes(item.situacao)) {
      return { encontrado: false as const };
    }

    return {
      encontrado: true as const,
      item: { ordem: item.ordem, titulo: item.titulo },
      opcao: (voto as any).opcao?.rotulo ?? "—",
      anulado: !!(voto as any).invalidado_em
    };
  });
