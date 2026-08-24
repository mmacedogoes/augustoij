import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { paraRomano } from "./romanos";
import { logAdminAction } from "@/lib/audit.server";

export const montarEdital = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ assembleiaId: z.string() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { data: assembleia, error } = await supabase
      .from("assembleias")
      .select("*, condominio:condominios(*), itens:assembleia_itens(*)")
      .eq("id", data.assembleiaId)
      .single();

    if (error || !assembleia) throw new Error("Assembleia não encontrada.");

    const dataObj = new Date(assembleia.data_inicio);
    const dia = dataObj.getDate();
    const mesExtenso = dataObj.toLocaleDateString('pt-BR', { month: 'long' });
    const ano = dataObj.getFullYear();
    const hora = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let texto = `${assembleia.condominio.nome.toUpperCase()}\n`;
    texto += `${assembleia.condominio.endereco || ""}\n\n`;
    texto += `CONVOCAÇÃO DE ASSEMBLEIA GERAL ${assembleia.tipo.toUpperCase()}\n\n`;
    
    texto += `Ficam os senhores condôminos convocados para a Assembleia Geral ${assembleia.tipo}, a realizar-se no dia ${dia} de ${mesExtenso} de ${ano}, às ${hora} em primeira convocação`;
    
    // Segunda convocação (geralmente 30 min depois se não houver campo específico, mas seguimos o banco)
    texto += `, e em segunda convocação 30 minutos após, no mesmo local, para deliberarem sobre a seguinte:\n\n`;
    
    texto += `ORDEM DO DIA\n\n`;
    
    const itensSorted = (assembleia.itens || []).sort((a: any, b: any) => a.ordem - b.ordem);
    itensSorted.forEach((item: any) => {
      texto += `${paraRomano(item.ordem)}. ${item.titulo.toUpperCase()}\n`;
      if (item.regra_quorum) {
        texto += `Quórum exigido: ${item.regra_quorum}\n`;
      }
      texto += `\n`;
    });

    texto += `ADVERTÊNCIA: Conforme o Artigo 1.335, inciso III, do Código Civil, é direito do condômino votar nas deliberações da assembleia e delas participar, estando quite.\n\n`;
    
    texto += `PROCURAÇÕES: Os condôminos poderão se fazer representar por procuradores devidamente constituídos.\n\n`;
    
    texto += `${assembleia.condominio.cidade || "Local"}, ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    texto += `_________________________________\n`;
    texto += `Administração / Síndico\n`;

    return { texto, assembleia };
  });

export const publicarEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    assembleiaId: z.string(),
    texto: z.string()
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const { error } = await supabase
      .from("assembleias")
      .update({
        edital_texto: data.texto,
        edital_publicado_em: new Date().toISOString(),
        situacao: "convocada"
      })
      .eq("id", data.assembleiaId);

    if (error) throw new Error(error.message);

    await logAdminAction({
      actorUserId: userId,
      action: "assembleia.edital.publicar" as any,
      metadata: { assembleia_id: data.assembleiaId }
    });

    return { success: true };
  });

export const melhorarRedacaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    assembleiaId: z.string(),
    itens: z.array(z.object({
      id: z.string(),
      titulo: z.string(),
      descricao: z.string().optional()
    }))
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAcessoAssembleias({ supabase, userId });

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("IA não configurada.");

    const prompt = `Você é um redator jurídico especializado em editais de condomínio.
Sua tarefa é melhorar a redação técnica das descrições dos itens da ordem do dia abaixo.

REGRAS:
- Mantenha o sentido original.
- NÃO altere valores, datas, nomes nem quóruns.
- Use linguagem formal e precisa de edital.
- Retorne APENAS um objeto JSON onde as chaves são os IDs dos itens e os valores são as novas descrições.

ITENS:
${JSON.stringify(data.itens, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error("Erro na IA.");
    const aiData = await response.json();
    return JSON.parse(aiData.choices[0].message.content);
  });
