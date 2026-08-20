import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";

export const registrarLinkWhatsapp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ destinatarioId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { error } = await supabase
      .from("assembleia_convocacao_destinatarios")
      .update({
        status_whatsapp: "link_aberto",
        whatsapp_link_aberto_em: new Date().toISOString(),
        whatsapp_link_aberto_por: userId
      })
      .eq("id", data.destinatarioId);

    if (error) throw new Error(error.message);

    await supabase.from("assembleia_convocacao_eventos").insert({
      destinatario_id: data.destinatarioId,
      canal: "whatsapp",
      tipo: "link_aberto",
      registrado_por: userId
    });

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.whatsapp_link" as any,
      metadata: { destinatario_id: data.destinatarioId }
    });

    return { success: true };
  });

export const confirmarEnvioWhatsapp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ destinatarioId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { error } = await supabase
      .from("assembleia_convocacao_destinatarios")
      .update({
        status_whatsapp: "confirmado",
        whatsapp_confirmado_em: new Date().toISOString(),
        whatsapp_confirmado_por: userId
      })
      .eq("id", data.destinatarioId);

    if (error) throw new Error(error.message);

    await supabase.from("assembleia_convocacao_eventos").insert({
      destinatario_id: data.destinatarioId,
      canal: "whatsapp",
      tipo: "confirmado_manual",
      registrado_por: userId
    });

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.whatsapp_confirmar" as any,
      metadata: { destinatario_id: data.destinatarioId }
    });

    return { success: true };
  });
