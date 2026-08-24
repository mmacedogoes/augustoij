import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";

export const enviarConvocacaoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    convocacaoId: z.string(),
    destinatarioIds: z.array(z.string()).optional() 
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: conv, error: convErr } = await supabase
      .from("assembleia_convocacoes")
      .select("*, assembleia:assembleias(*, condominio:condominios(*), itens:assembleia_itens(*))")
      .eq("id", data.convocacaoId)
      .single();

    if (convErr || !conv) throw new Error("Convocação não encontrada.");

    let query = supabase
      .from("assembleia_convocacao_destinatarios")
      .select("*")
      .eq("convocacao_id", data.convocacaoId)
      .not("email", "is", null);

    if (data.destinatarioIds) {
      query = query.in("id", data.destinatarioIds);
    } else {
      // Idempotência: Ignora quem já foi enviado/entregue
      query = query.in("status_email", ["pendente", "falhou"]);
    }

    const { data: destinatarios, error: destErr } = await query;
    if (destErr) throw new Error(destErr.message);

    if (!destinatarios || destinatarios.length === 0) return { success: true, count: 0 };

    // Lógica de Envio em Lote (Resend mock/lote)
    const { compilarEmailConvocacao } = await import("./email-compiler.server");

    for (const d of destinatarios) {
      const html = compilarEmailConvocacao({
        previewTexto: `Convocação de Assembleia - ${conv.assembleia.condominio.nome}`,
        tipoEtiqueta: conv.assembleia.tipo.toUpperCase(),
        tituloCabecalho: "Convocação de Assembleia",
        nomeCondominio: conv.assembleia.condominio.nome,
        nomeDestinatario: d.nome,
        unidade: `Unidade ${d.unidade_id}`, 
        mensagemAbertura: "Convocamos V.S.ª para participar da próxima assembleia.",
        dataExtenso: new Date(conv.assembleia.data_hora).toLocaleDateString('pt-BR', { dateStyle: 'long' }),
        horario: new Date(conv.assembleia.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        convocacaoNumero: conv.assembleia.convocacao_numero,
        local: conv.assembleia.local || "A definir",
        modalidade: conv.assembleia.modalidade,
        urlEdital: `https://augustoij.com.br/e/${conv.assembleia.codigo_publico}`,
        itens: conv.assembleia.itens.map((it: any) => ({
          ordem: it.ordem,
          titulo: it.titulo,
          descricao: it.descricao,
          quorum: it.regra_quorum || "Maioria Simples"
        })),
        assinaturaNome: "Augusto.IJ",
        assinaturaCargo: "Sistema de Gestão",
        ano: new Date().getFullYear().toString()
      });

      // Simulação de sucesso Resend
      const resendMessageId = crypto.randomUUID();

      await supabase
        .from("assembleia_convocacao_destinatarios")
        .update({ 
          status_email: "enviado",
          email_enviado_em: new Date().toISOString(),
          resend_message_id: resendMessageId
        })
        .eq("id", d.id);

      await supabase.from("assembleia_convocacao_eventos").insert({
        destinatario_id: d.id,
        canal: "email",
        tipo: "enviado",
        registrado_por: userId
      });
    }

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.enviar_email" as any,
      metadata: { convocacao_id: data.convocacaoId, count: destinatarios.length }
    });

    return { success: true, count: destinatarios.length };
  });

export const registrarEntregaFisica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ destinatarioId: z.string(), protocolo: z.string(), data: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    await supabase
      .from("assembleia_convocacao_destinatarios")
      .update({ 
        entrega_fisica_em: data.data, 
        entrega_fisica_protocolo: data.protocolo,
        canal: 'sem_contato' // Marca como entrega física
      })
      .eq("id", data.destinatarioId);

    await supabase.from("assembleia_convocacao_eventos").insert({
      destinatario_id: data.destinatarioId,
      canal: "fisico",
      tipo: "entrega_fisica",
      registrado_por: userId
    });

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.entrega_fisica" as any,
      metadata: { destinatario_id: data.destinatarioId }
    });

    return { success: true };
  });
