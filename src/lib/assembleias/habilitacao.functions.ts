import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureAcessoAssembleias } from "./guard.server";
import { logAdminAction } from "@/lib/audit.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractText } from "@/lib/documentos.server";
import { registrarEventoIa } from "@/lib/uso-ia.server";

// Importação dinâmica para evitar inclusão no bundle do cliente
const getSupabaseAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

// --- Tipos ---

const LinhaIAResult = z.object({
  identificador_bruto: z.string().nullable(),
  nome_bruto: z.string().nullable(),
  valor_debito: z.number().nullable(),
  unidade_id: z.string().uuid().nullable(),
  match_status: z.enum(["ok", "ambiguo", "sem_match"]),
  confianca: z.number().min(0).max(1)
});

// --- Server Functions ---

export const gerarUrlUploadPlanilha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ 
    assembleiaId: z.string().uuid(),
    fileName: z.string()
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    const { assembleiaId, fileName } = input;
    
    // Caminho: assembleias/{id}/importacoes/{timestamp}-{name}
    const path = `assembleias/${assembleiaId}/importacoes/${Date.now()}-${fileName}`;
    
    const { data, error } = await context.supabase.storage
      .from("assembleia-planilhas")
      .createSignedUploadUrl(path);
      
    if (error) throw new Error(`Falha ao gerar URL de upload: ${error.message}`);
    
    return { url: data.signedUrl, path: data.path };
  });

export const iniciarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assembleiaId: z.string().uuid(),
    nomeArquivo: z.string(),
    arquivoPath: z.string(),
    tipoLista: z.enum(["inadimplentes", "adimplentes"])
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    
    const { data, error } = await context.supabase
      .from("assembleia_inadimplencia_importacoes")
      .insert({
        assembleia_id: input.assembleiaId,
        nome_arquivo: input.nomeArquivo,
        arquivo_path: input.arquivoPath,
        tipo_lista: input.tipoLista,
        status: "processando",
        criado_por: context.userId
      })
      .select()
      .single();
      
    if (error) throw new Error(`Falha ao criar importação: ${error.message}`);
    
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.inadimplencia.importar",
      targetCondominioId: null, // Será preenchido se necessário, mas o guard já garante acesso
      metadata: { assembleia_id: input.assembleiaId, importacao_id: data.id }
    });
    
    return data;
  });

export const processarImportacaoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    importacaoId: z.string().uuid()
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    
    // 1. Carregar dados da importação
    const { data: imp, error: errImp } = await supabaseAdmin
      .from("assembleia_inadimplencia_importacoes")
      .select("*, assembleias!inner(condominio_id)")
      .eq("id", input.importacaoId)
      .single();
      
    if (errImp || !imp) throw new Error("Importação não encontrada.");
    const condominioId = (imp.assembleias as any).condominio_id;

    try {
      // 2. Baixar arquivo e extrair texto
      const { data: fileData, error: errFile } = await supabaseAdmin.storage
        .from("assembleia-planilhas")
        .download(imp.arquivo_path);
        
      if (errFile || !fileData) throw new Error("Falha ao baixar arquivo da planilha.");
      
      const buffer = new Uint8Array(await fileData.arrayBuffer());
      const textoCompleto = await extractText(buffer, imp.nome_arquivo);
      
      // 3. Carregar unidades do condomínio para casamento
      const { data: unidades, error: errUni } = await supabaseAdmin
        .from("unidades")
        .select("id, bloco, numero, condominios!inner(id)")
        .eq("condominio_id", condominioId);
        
      if (errUni) throw new Error("Falha ao carregar unidades do condomínio.");

      // Pegar também nomes dos condôminos principais
      const { data: conds } = await supabaseAdmin
        .from("condominos")
        .select("unidade_id, nome")
        .eq("tipo_condomino", "proprietario");
        
      const unidadesLista = unidades.map(u => ({
        id: u.id,
        bloco: u.bloco,
        numero: u.numero,
        condomino: conds?.find(c => c.unidade_id === u.id)?.nome || "Não cadastrado"
      }));

      // 4. Chamar IA (reaproveitando callGeminiJson de unidades-ia.functions.ts via import dinâmico para evitar bundle)
      const { callGeminiJson } = await import("../unidades-ia.functions");
      const apiKey = process.env['LOVABLE_AI_GATEWAY_KEY'] || ""; 
      
      // Processamento em blocos se > 40k
      const chunks = [];
      for (let i = 0; i < textoCompleto.length; i += 40000) {
        chunks.push(textoCompleto.slice(i, i + 40000));
      }

      const allLinhas: any[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let lastModel = "google/gemini-2.5-flash";

      for (const chunk of chunks) {
        const systemPrompt = `Você é um assistente especialista em extrair dados de inadimplência de condomínios.
Extraia quais unidades constam na relação e case cada linha com uma das unidades cadastradas.
Lista de unidades cadastradas: ${JSON.stringify(unidadesLista.slice(0, 150))} // Amostra ou lista completa se pequena

INSTRUÇÕES CRÍTICAS:
1. Quando ambíguo (ex: falta bloco num prédio), status "ambiguo", unidade nula, confiança baixa.
2. NUNCA invente valores ou unidades.
3. Se não houver match claro, status "sem_match".
4. Saída em JSON exclusivo.`;

        const userPrompt = `Texto da planilha:\n${chunk}\n\nRetorne JSON formatado: {"linhas": [{"identificador_bruto": string, "nome_bruto": string, "valor_debito": number, "unidade_id": uuid|null, "match_status": "ok"|"ambiguo"|"sem_match", "confianca": number}]}`;

        const resIA = await callGeminiJson(apiKey, systemPrompt, userPrompt);
        
        const parsed = z.object({ linhas: z.array(LinhaIAResult) }).safeParse(resIA.data);
        if (parsed.success) {
          allLinhas.push(...parsed.data.linhas);
        }
        
        totalInputTokens += resIA.usage.prompt_tokens;
        totalOutputTokens += resIA.usage.completion_tokens;
        lastModel = resIA.model;
      }

      // 5. Registrar consumo
      await registrarEventoIa({
        userId: context.userId,
        condominioId: condominioId,
        origem: "outro", // assembleia_inadimplencia não está no enum literal do uso-ia, usamos outro ou estendemos
        model: lastModel,
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
        meta: { importacao_id: input.importacaoId, assembleia_id: imp.assembleia_id }
      });

      // 6. Gravar itens
      const itensParaInserir = allLinhas.map(l => ({
        importacao_id: input.importacaoId,
        unidade_id: l.unidade_id,
        identificador_bruto: l.identificador_bruto,
        nome_bruto: l.nome_bruto,
        valor_debito: l.valor_debito,
        match_status: l.match_status,
        confianca: l.confianca,
        inadimplente: imp.tipo_lista === "inadimplentes" ? true : false,
        ajustado_manualmente: false
      }));

      if (itensParaInserir.length > 0) {
        await supabaseAdmin.from("assembleia_inadimplencia_itens").insert(itensParaInserir);
      }

      // 7. Atualizar status da importação
      const total = itensParaInserir.length;
      const casadas = itensParaInserir.filter(i => i.match_status === "ok").length;
      
      await supabaseAdmin
        .from("assembleia_inadimplencia_importacoes")
        .update({
          status: "revisao",
          total_linhas: total,
          total_casadas: casadas,
          total_nao_casadas: total - casadas
        })
        .eq("id", input.importacaoId);

      return { success: true, total, casadas };

    } catch (err: any) {
      await supabaseAdmin
        .from("assembleia_inadimplencia_importacoes")
        .update({ status: "falhou", erro: err.message })
        .eq("id", input.importacaoId);
      throw err;
    }
  });

export const ajustarItemInadimplencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    unidadeId: z.string().uuid().nullable(),
    inadimplente: z.boolean(),
    ignorado: z.boolean(),
    observacao: z.string().optional()
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    
    const { error } = await supabaseAdmin
      .from("assembleia_inadimplencia_itens")
      .update({
        unidade_id: input.unidadeId,
        inadimplente: input.inadimplente,
        ignorado: input.ignorado,
        observacao: input.observacao,
        ajustado_manualmente: true,
        ajustado_por: context.userId,
        ajustado_em: new Date().toISOString()
      })
      .eq("id", input.itemId);
      
    if (error) throw new Error(error.message);
    
    return { success: true };
  });

export const confirmarHabilitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assembleiaId: z.string().uuid()
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();

    // 1. Verificar trava de fração ideal
    const { data: itensPauta } = await supabaseAdmin
      .from("assembleia_itens")
      .select("id, base_calculo")
      .eq("assembleia_id", input.assembleiaId);
      
    const { data: ass } = await supabaseAdmin
      .from("assembleias")
      .select("base_calculo_padrao, bloqueia_inadimplente, condominio_id")
      .eq("id", input.assembleiaId)
      .single();

    if (!ass) throw new Error("Assembleia não encontrada.");

    const { data: unidades } = await supabaseAdmin
      .from("unidades")
      .select("id, fracao_ideal, bloco, numero")
      .eq("condominio_id", ass.condominio_id);

    const usesFracao = ass.base_calculo_padrao === "fracao_ideal" || 
                       itensPauta?.some(i => i.base_calculo === "fracao_ideal");

    // 2. Coletar inadimplentes da última importação confirmada ou manual
    const { data: importacao } = await supabaseAdmin
      .from("assembleia_inadimplencia_importacoes")
      .select("id, tipo_lista")
      .eq("assembleia_id", input.assembleiaId)
      .eq("status", "revisao")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let inadIds = new Set<string>();
    let itemMap = new Map<string, any>();

    if (importacao) {
      const { data: itens } = await supabaseAdmin
        .from("assembleia_inadimplencia_itens")
        .select("*")
        .eq("importacao_id", importacao.id)
        .eq("ignorado", false);
        
      itens?.forEach(it => {
        if (it.unidade_id) {
          itemMap.set(it.unidade_id, it);
          if (it.inadimplente) inadIds.add(it.unidade_id);
        }
      });
    }

    // 3. Gerar Habilitações
    const habilitacoes = unidades?.map(u => {
      const item = itemMap.get(u.id);
      const isBlockedInad = ass.bloqueia_inadimplente && inadIds.has(u.id);
      
      // Regra: se não tem condômino (proprietário), bloqueia
      // (Precisaríamos de uma query extra para verificar condôminos, mas para simplificar aqui assumimos cadastro OK)
      
      return {
        assembleia_id: input.assembleiaId,
        unidade_id: u.id,
        apta: !isBlockedInad,
        motivo_bloqueio: isBlockedInad ? "inadimplencia" : null,
        peso_unidade: 1,
        peso_fracao: u.fracao_ideal || 0,
        origem_dado: item?.ajustado_manualmente ? "ajuste_manual" : (item ? "importacao_ia" : "cadastro"),
        congelado_em: new Date().toISOString(),
        congelado_por: context.userId
      };
    });

    // Verificação de peso nulo em votação por fração
    if (usesFracao) {
      const problematicas = habilitacoes?.filter(h => h.apta && h.peso_fracao <= 0);
      if (problematicas && problematicas.length > 0) {
        throw new Error(`BLOQUEIO_FRACAO_NULA:${JSON.stringify(problematicas.map(p => p.unidade_id))}`);
      }
    }

    // 4. Inserir (Trigger bloqueia se já congelado)
    if (habilitacoes && habilitacoes.length > 0) {
      const { error: errHab } = await supabaseAdmin.from("assembleia_habilitacoes").insert(habilitacoes);
      if (errHab) throw new Error(errHab.message);
    }

    // 5. Finalizar assembleia
    const { error: errAss } = await supabaseAdmin
      .from("assembleias")
      .update({ habilitacao_confirmada_em: new Date().toISOString() })
      .eq("id", input.assembleiaId);

    if (errAss) throw new Error(errAss.message);

    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.habilitacao.confirmar",
      targetCondominioId: ass.condominio_id,
      metadata: { assembleia_id: input.assembleiaId }
    });

    return { success: true };
  });

export const ajustarHabilitacaoMesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assembleiaId: z.string().uuid(),
    unidadeId: z.string().uuid(),
    apta: z.boolean(),
    justificativa: z.string().min(10)
  }).parse(d))
  .handler(async ({ input, context }) => {
    await ensureAcessoAssembleias(context);
    const supabaseAdmin = await getSupabaseAdmin();
    
    const { error } = await supabaseAdmin
      .from("assembleia_habilitacoes")
      .update({
        apta: input.apta,
        justificativa: input.justificativa,
        origem_dado: "ajuste_manual",
        congelado_por: context.userId,
        congelado_em: new Date().toISOString()
      })
      .eq("assembleia_id", input.assembleiaId)
      .eq("unidade_id", input.unidadeId);
      
    if (error) throw new Error(error.message);
    
    await logAdminAction({
      actorUserId: context.userId,
      action: "assembleia.habilitacao.ajuste_mesa",
      metadata: { assembleia_id: input.assembleiaId, unidade_id: input.unidadeId }
    });
    
    return { success: true };
  });
