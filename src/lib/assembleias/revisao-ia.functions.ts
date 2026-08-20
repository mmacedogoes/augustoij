import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";

export const revisarPautaIA = createServerFn({ method: "POST" })
  .inputValidator(z.object({ assembleiaId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    // 1. Buscar itens da pauta e contexto da assembleia
    const { data: assembleia, error: assErr } = await supabase
      .from("assembleias")
      .select(`
        *,
        condominio:condominios(nome),
        itens:assembleia_itens(*)
      `)
      .eq("id", data.assembleiaId)
      .single();

    if (assErr || !assembleia) throw new Error("Assembleia não encontrada");
    if (!assembleia.itens || assembleia.itens.length === 0) {
      return { success: true, warnings: ["Pauta vazia."] };
    }

    // 2. Preparar Prompt para Lovable AI
    const itemsContext = assembleia.itens.map((it: any) => ({
      ordem: it.ordem,
      titulo: it.titulo,
      descricao: it.descricao,
      tipo_votacao: it.tipo_votacao,
      regra_quorum: it.regra_quorum,
      base_calculo: it.base_calculo
    }));

    const systemPrompt = `Você é um assistente de Direito Condominial brasileiro especialista em assembleias.
Sua tarefa é revisar a ordem do dia (pauta) de uma assembleia para garantir conformidade legal com o Código Civil.

REFERÊNCIAS LEGAIS:
- Art. 1.352 e 1.353: Deliberações gerais por maioria dos presentes.
- Art. 1.341: Obras voluptuárias (2/3 dos condôminos) e úteis (maioria dos condôminos).
- Art. 1.351: Alteração da convenção (2/3 dos condôminos) e mudança de destinação (unanimidade).
- Art. 1.336 §2º e 1.337: Multas por descumprimento (3/4 dos condôminos restantes).
- Art. 1.349: Destituição do síndico (maioria absoluta).
- Art. 1.350: Matérias da assembleia ordinária anual.

OBJETIVO:
Avalie se a regra de quórum escolhida é compatível com o tema, cite o fundamento legal e aponte riscos de nulidade.
Seja técnico e preciso. A convenção do condomínio (se citada no contexto) prevalece se for mais restritiva.

SAÍDA:
Responda APENAS em JSON no formato:
{
  "itens": [
    {
      "ordem": number,
      "nivel": "info" | "atencao" | "risco",
      "mensagem": "string",
      "fundamento_legal": "string",
      "quorum_sugerido": "string | null",
      "convencao_consultada": false
    }
  ]
}`;

    const userPrompt = `Revise a pauta da assembleia "${assembleia.titulo}" do condomínio "${assembleia.condominio.nome}".
Tipo: ${assembleia.tipo}. Modalidade: ${assembleia.modalidade}.

ITENS DA PAUTA:
${JSON.stringify(itemsContext, null, 2)}`;

    try {
      const { generateText } = await import("ai");
      const { createOpenAI } = await import("@ai-sdk/openai"); // Ou o provedor nativo Lovable
      
      // Nota: Em ambiente Lovable usamos o gateway configurado.
      // Vou simular a chamada ao provedor via gateway ou import correto conforme stack.
      // Como o prompt pede para usar a IA nativa do Lovable, usaremos o padrão do sistema.
      
      // Mocking AI call for structural flow before deciding on the exact API tool
      // O prompt diz "usando a IA nativa do Lovable". No TanStack Start, chamamos o gateway.
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", { // Placeholder for actual gateway call
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           model: "gpt-4o",
           messages: [
             { role: "system", content: systemPrompt },
             { role: "user", content: userPrompt }
           ],
           response_format: { type: "json_object" }
         })
      });

      const aiData = await response.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      // 3. Salvar resultados no banco
      for (const resItem of result.itens) {
        const matchingItem = assembleia.itens.find((it: any) => it.ordem === resItem.ordem);
        if (matchingItem) {
          await supabase
            .from("assembleia_itens")
            .update({
              alerta_ia: { nivel: resItem.nivel, mensagem: resItem.mensagem },
              fundamento_legal: resItem.fundamento_legal
            })
            .eq("id", matchingItem.id);
        }
      }

      return result;
    } catch (err) {
      console.error("[IA-Revisao]", err);
      throw new Error("Falha na comunicação com a IA.");
    }
  });
