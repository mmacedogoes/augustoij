import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";

export const montarConvocacao = createServerFn({ method: "POST" })
  .inputValidator(z.object({ assembleiaId: z.string(), tipo: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    // 1. Criar registro da convocação
    const { data: conv, error: convErr } = await supabase
      .from("assembleia_convocacoes")
      .insert({
        assembleia_id: data.assembleiaId,
        tipo: data.tipo,
        situacao: "rascunho",
        criada_por: userId
      })
      .select()
      .single();

    if (convErr) throw new Error(convErr.message);

    // 2. Montar destinatários (unidade por unidade)
    const { data: unidades, error: uniErr } = await supabase
      .from("unidades")
      .select("id, bloco, numero, condominios(id), condominios_condominos(*)");

    if (uniErr) throw new Error(uniErr.message);

    const destinatarios = [];
    for (const uni of unidades) {
      const conds = uni.condominios_condominos || [];
      // Lógica de prioridade
      const principal = conds.find((c: any) => c.eh_principal) || 
                       conds.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

      destinatarios.push({
        convocacao_id: conv.id,
        unidade_id: uni.id,
        nome: principal ? principal.nome : "Unidade sem condômino cadastrado",
        email: principal?.email || null,
        telefone_bruto: principal?.telefone || null,
        status_email: "pendente",
        status_whatsapp: "pendente"
      });
    }

    const { error: destErr } = await supabase.from("assembleia_convocacao_destinatarios").insert(destinatarios);
    if (destErr) throw new Error(destErr.message);

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.convocacao.montar" as any,
      metadata: { convocacao_id: conv.id }
    });

    return conv;
  });
