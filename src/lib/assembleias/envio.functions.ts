import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";

export const getDadosConvocacao = createServerFn({ method: "GET" })
  .inputValidator(z.object({ convocacaoId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: conv, error } = await supabase
      .from("assembleia_convocacoes")
      .select("*, destinatarios:assembleia_convocacao_destinatarios(*)")
      .eq("id", data.convocacaoId)
      .single();

    if (error) throw new Error(error.message);
    return conv;
  });

export const enviarConvocacaoEmail = createServerFn({ method: "POST" })
  .inputValidator(z.object({ 
    convocacaoId: z.string(),
    destinatarioIds: z.array(z.string()).optional() 
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    // Envio simulado/lote conforme plano
    // Logar ação em assembleia_convocacao_eventos
    
    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.enviar_email" as any,
      metadata: { convocacao_id: data.convocacaoId }
    });

    return { success: true };
  });

export const registrarEntregaFisica = createServerFn({ method: "POST" })
  .inputValidator(z.object({ destinatarioId: z.string(), protocolo: z.string(), data: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    await supabase
      .from("assembleia_convocacao_destinatarios")
      .update({ entrega_fisica_em: data.data, entrega_fisica_protocolo: data.protocolo })
      .eq("id", data.destinatarioId);

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.entrega_fisica" as any,
      metadata: { destinatario_id: data.destinatarioId }
    });

    return { success: true };
  });
