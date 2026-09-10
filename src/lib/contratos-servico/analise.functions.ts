/**
 * Análise contratual com semáforo e cruzamento com a base de "Treinar a IA".
 *
 * Extrai o texto do arquivo do contrato (bucket `contratos` ou `documentos`
 * quando o contrato veio do acervo), realiza busca semântica na base privada
 * de conhecimento (`kb_documentos`, `kb_chunks` e `ai_orientacoes`), confronta
 * o documento com os modelos de contratos padrão (adotados como Padrão-Ouro /
 * Gold Standard) e devolve três blocos — pontos positivos, negativos e de
 * atenção — persistindo o resultado em `contratos_servico.analise_resultado`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";
import { registrarEventoIa } from "@/lib/uso-ia.server";
import { PLANOS, type PlanoId as PlanoIdV2 } from "@/config/planos";
import { resolvePlanId, isTrialExpired, gateMessages } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";

async function assertAnalisePermitida(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const { getSubscriptionEfetiva } = await import("@/lib/conta-master.server");
  const [sub, admin] = await Promise.all([
    getSubscriptionEfetiva(userId),
    isAdminInternoServer(supabase, userId),
  ]);
  const planoBruto = resolvePlanId(sub?.plano_config_id ?? null);
  const cortesia = sub?.cortesia === true || admin;
  if (cortesia) return;
  if (isTrialExpired(planoBruto, sub?.trial_end ?? null)) {
    throw new Error(gateMessages.trialExpirado());
  }
  const planoV2Id: PlanoIdV2 = (planoBruto as string) in PLANOS ? (planoBruto as PlanoIdV2) : "gratuito";
  const limite = PLANOS[planoV2Id].limites.analisesContrato;
  if (limite === null) return; // ilimitado
  const { count } = await supabase
    .from("contratos_servico")
    .select("id, condominios!inner(owner_id)", { count: "exact", head: true })
    .eq("condominios.owner_id", userId)
    .not("analise_em", "is", null);
  if ((count ?? 0) >= limite) {
    if (planoV2Id === "gratuito") throw new Error(gateMessages.analiseGratuitoConsumida());
    throw new Error(gateMessages.analiseContratos());
  }
}

const MODEL = "google/gemini-2.5-flash";
const AIG_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type PontoAnalise = {
  titulo: string;
  detalhe: string;
  clausula?: string | null;
};

export type ResultadoAnalise = {
  pontos_positivos: PontoAnalise[];
  pontos_negativos: PontoAnalise[];
  pontos_atencao: PontoAnalise[];
  resumo: string | null;
  modelos_comparados?: string[];
  base_treinamento_utilizada?: boolean;
  gerado_em: string;
  modelo: string;
};

export type ContextoTreinamentoContrato = {
  contextoTexto: string;
  modelosComparados: string[];
  orientacoesAplicadas: string[];
  temBasePrivada: boolean;
};

function parseJsonLoose(raw: string): unknown {
  const s = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s); } catch { /* noop */ }
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch { /* noop */ }
  }
  throw new Error("A IA não devolveu JSON válido");
}

function normalizarPontos(v: unknown): PontoAnalise[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((x) => {
    if (typeof x === "string") return { titulo: x.slice(0, 200), detalhe: "" };
    const o = (x ?? {}) as Record<string, unknown>;
    return {
      titulo: String(o.titulo ?? o.title ?? "").slice(0, 200),
      detalhe: String(o.detalhe ?? o.detail ?? o.descricao ?? "").slice(0, 1200),
      clausula: (o.clausula ?? o.clausula_origem ?? null) as string | null,
    };
  }).filter((p) => p.titulo || p.detalhe);
}

async function extrairTextoContrato(
  buffer: Uint8Array,
  nomeArquivo: string,
  apiKey: string,
): Promise<string> {
  const { extractText, extractTextWithVision } = await import("@/lib/documentos.server");
  try {
    const t = await extractText(buffer, nomeArquivo);
    if (t.trim().length > 40) return t;
    throw new Error("__NEEDS_VISION__");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "__NEEDS_VISION__") {
      return extractTextWithVision(apiKey, buffer, nomeArquivo);
    }
    throw e;
  }
}

/**
 * Consulta a base de conhecimento privada de "Treinar a IA" (kb_documentos,
 * match_kb_chunks e ai_orientacoes) recuperando os modelos de contratos padrão
 * e diretrizes institucionais para servir de parâmetro de conformidade e benchmark.
 */
export async function buscarContextoTreinamentoContratos({
  supabase,
  apiKey,
  textoContrato,
  tipoServico,
  prestadorNome,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  apiKey: string;
  textoContrato: string;
  tipoServico?: string | null;
  prestadorNome?: string | null;
}): Promise<ContextoTreinamentoContrato> {
  const modelosComparados: string[] = [];
  const orientacoesAplicadas: string[] = [];
  const secoesContexto: string[] = [];

  try {
    // 1. Carregar Orientações Ativas de Governança (ai_orientacoes)
    const { data: orientacoes, error: errOri } = await supabase
      .from("ai_orientacoes")
      .select("titulo, conteudo")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (!errOri && orientacoes && orientacoes.length > 0) {
      const linhasOri: string[] = [];
      for (const o of orientacoes) {
        orientacoesAplicadas.push(o.titulo);
        linhasOri.push(`- **${o.titulo}**: ${o.conteudo.trim()}`);
      }
      secoesContexto.push(
        `=== DIRETRIZES E ORIENTAÇÕES NORMATIVAS (BASE "TREINAR A IA") ===\n${linhasOri.join("\n\n")}`,
      );
    }

    // 2. Carregar Modelos de Contratos e Minutas Padrão da KB (kb_documentos)
    const { data: kbDocs, error: errDocs } = await supabase
      .from("kb_documentos")
      .select("id, titulo, tipo, fonte, conteudo_bruto")
      .eq("status_processamento", "pronto")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!errDocs && kbDocs && kbDocs.length > 0) {
      const modelosPeca = kbDocs.filter((d) => {
        const tit = (d.titulo || "").toLowerCase();
        const tipo = d.tipo || "";
        return (
          tipo === "peca" ||
          tipo === "orientacao" ||
          tit.includes("contrato") ||
          tit.includes("minuta") ||
          tit.includes("locação") ||
          tit.includes("locacao") ||
          tit.includes("prestação") ||
          tit.includes("prestacao") ||
          tit.includes("portaria") ||
          tit.includes("limpeza") ||
          tit.includes("manutenção") ||
          tit.includes("manutencao") ||
          tit.includes("modelo") ||
          tit.includes("padrão") ||
          tit.includes("padrao")
        );
      });

      if (modelosPeca.length > 0) {
        const blocosModelos: string[] = [];
        for (const m of modelosPeca.slice(0, 5)) {
          if (!modelosComparados.includes(m.titulo)) {
            modelosComparados.push(m.titulo);
          }
          const conteudo = m.conteudo_bruto
            ? m.conteudo_bruto.slice(0, 4500)
            : `(Modelo de minuta de referência cadastrado como "${m.titulo}")`;
          blocosModelos.push(
            `### MODELO DE REFERÊNCIA (PADRÃO-OURO): ${m.titulo.toUpperCase()} [${m.tipo}]\n${conteudo.trim()}`,
          );
        }
        secoesContexto.push(
          `=== MODELOS DE CONTRATOS & MINUTAS PADRÃO DO ESCRITÓRIO (PADRÃO-OURO / BENCHMARK) ===\n${blocosModelos.join("\n\n---\n\n")}`,
        );
      }
    }

    // 3. Busca Vetorial Semântica na Base de Conhecimento (match_kb_chunks)
    try {
      const { embedText } = await import("@/lib/ai-gateway.server");
      const termoBusca = [
        "Contrato de prestação de serviços para condomínio edilício",
        tipoServico ? `serviço de ${tipoServico}` : "",
        prestadorNome ? `prestador ${prestadorNome}` : "",
        "cláusulas essenciais protetivas, retenção tributária, responsabilidade civil, terceirização trabalhista Súmula 331 TST, rescisão desmotivada, garantias e penalidades",
        textoContrato.slice(0, 600),
      ]
        .filter(Boolean)
        .join(". ");

      const queryEmbedding = await embedText(apiKey, termoBusca.slice(0, 1000));
      const { data: matches, error: errMatch } = await supabase.rpc("match_kb_chunks", {
        _query_embedding: `[${queryEmbedding.join(",")}]` as unknown as string,
        _match_count: 8,
        _min_similarity: 0.18,
      });

      if (!errMatch && matches && Array.isArray(matches) && matches.length > 0) {
        const chunksTexto: string[] = [];
        for (const m of matches as Array<{ titulo: string; tipo: string; fonte: string | null; conteudo: string }>) {
          if (!modelosComparados.includes(m.titulo)) {
            modelosComparados.push(m.titulo);
          }
          const meta = [m.titulo, m.tipo ? `tipo: ${m.tipo}` : "", m.fonte ? `fonte: ${m.fonte}` : ""]
            .filter(Boolean)
            .join(" — ");
          chunksTexto.push(`[${meta}]\n${m.conteudo.trim()}`);
        }
        secoesContexto.push(
          `=== TRECHOS NORMATIVOS E DISPOSITIVOS CORRELATOS DA BASE DE TREINAMENTO ===\n${chunksTexto.join("\n\n---\n\n")}`,
        );
      }
    } catch (embErr) {
      console.warn("[analise] busca vetorial kb:", embErr);
    }
  } catch (err) {
    console.error("[analise] erro ao carregar contexto de treinamento:", err);
  }

  const temBasePrivada = secoesContexto.length > 0;
  return {
    contextoTexto: secoesContexto.join("\n\n\n"),
    modelosComparados,
    orientacoesAplicadas,
    temBasePrivada,
  };
}

export const analisarContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    await assertAnalisePermitida(context.supabase, context.userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Serviço de IA indisponível no momento.");

    const { data: c, error } = await context.supabase
      .from("contratos_servico")
      .select(
        "id, condominio_id, prestador_nome, arquivo_path, documento_id, tipos_servico_contrato(nome)",
      )
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contrato não encontrado.");

    if (!c.arquivo_path && !c.documento_id) {
      throw new Error("Anexe o arquivo do contrato antes de rodar a análise.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let buffer: Uint8Array;
    let nomeArquivo: string;

    if (c.arquivo_path) {
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("contratos").download(c.arquivo_path);
      if (dlErr || !file) throw new Error("Não foi possível ler o arquivo do contrato.");
      buffer = new Uint8Array(await file.arrayBuffer());
      nomeArquivo = c.arquivo_path.split("/").pop() ?? "contrato.pdf";
    } else {
      const { data: doc, error: dErr } = await supabaseAdmin
        .from("documentos")
        .select("storage_path, nome_arquivo")
        .eq("id", c.documento_id as string)
        .maybeSingle();
      if (dErr || !doc) throw new Error("Documento vinculado não foi encontrado.");
      const { data: file, error: dlErr } = await supabaseAdmin.storage
        .from("documentos").download(doc.storage_path);
      if (dlErr || !file) throw new Error("Não foi possível ler o arquivo do contrato.");
      buffer = new Uint8Array(await file.arrayBuffer());
      nomeArquivo = doc.nome_arquivo ?? "contrato.pdf";
    }

    if (buffer.byteLength === 0) throw new Error("Arquivo do contrato está vazio.");

    const texto = await extrairTextoContrato(buffer, nomeArquivo, apiKey);
    if (!texto || texto.trim().length < 40) {
      throw new Error("Não foi possível extrair o texto do contrato para análise.");
    }
    const cortado = texto.slice(0, 60000);

    const tipoNome = (c as { tipos_servico_contrato?: { nome: string } | null })?.tipos_servico_contrato?.nome ?? null;

    // Recuperar o benchmark da base privada "Treinar a IA" (modelos, orientações e chunks)
    const { contextoTexto, modelosComparados, temBasePrivada } = await buscarContextoTreinamentoContratos({
      supabase: context.supabase,
      apiKey,
      textoContrato: cortado,
      tipoServico: tipoNome,
      prestadorNome: c.prestador_nome,
    });

    const system = `Você é o Augusto, consultor e inteligência jurídica especializada em Direito Condominial e Imobiliário.
Sua missão é realizar a REVISÃO CRÍTICA E ANÁLISE COMPARATIVA DE RISCOS de um contrato de prestação de serviços firmado por um condomínio edilício.

DIRETRIZ MANDATÓRIA — MODELOS DA BASE PRIVADA COMO PADRÃO-OURO (GOLD STANDARD):
${
  temBasePrivada
    ? `Você recebeu os MODELOS DE CONTRATOS, MINUTAS PADRÃO e ORIENTAÇÕES JURÍDICAS da base privada de conhecimento ("Treinar a IA").
Você DEVE tomar esses modelos como o padrão-ouro (a referência mais completa, segura e protetiva para o condomínio), confrontando o contrato do prestador diretamente contra esses modelos de referência.`
    : `Considere as melhores práticas protetivas do Direito Condominial Brasileiro (Código Civil, Súmulas do TST, legislação tributária e LGPD) como o padrão ideal de referência.`
}

CRITÉRIOS DE CONFRONTO E ANÁLISE JURÍDICA:
1. CONFRONTO COMPARATIVO COM OS MODELOS PADRÃO:
   - Verifique minuciosamente quais cláusulas essenciais presentes nos modelos padrão estão AUSENTES, INCOMPLETAS ou DEFICITÁRIAS no contrato analisado.
   - Destaque em "pontos_atencao" ou "pontos_negativos" as omissões críticas, tais como:
     * Omissão de cláusula expressa de retenções tributárias na fonte (IRRF, PIS/COFINS/CSLL, INSS e ISSQN, conforme legislação aplicável).
     * Omissão de cláusula de fiscalização trabalhista e previdenciária mensal (apresentação de GFIP/eSocial, guias de FGTS e folha de pagamento para mitigar a responsabilidade subsidiária da Súmula 331 do TST na terceirização de mão de obra).
     * Omissão de exigência de Apólice de Seguro de Responsabilidade Civil com cobertura adequada.
     * Omissão de SLA (Acordo de Nível de Serviço) claro, com métricas objetivas de execução e penalidades graduais por atraso ou falha.
     * Ausência de cláusulas de conformidade com a LGPD (Lei 13.709/2018) e sigilo/confidencialidade.
2. IDENTIFICAÇÃO DE CLÁUSULAS ABUSIVAS OU DESPROPORCIONAIS (PONTOS NEGATIVOS):
   - Prazos de aviso prévio para rescisão imotivada excessivos (ex.: aviso de 60 ou 90 dias quando o modelo estipula 30 dias).
   - Multas rescisórias abusivas ou cláusulas de fidelidade excessiva sem previsão expressa de rescisão imediata e sem ônus por descumprimento de obrigações ou infração contratual.
   - Índices de reajuste desfavoráveis, reajustes unilaterais ou renovação automática sem faculdade de notificação prévia de não renovação.
   - Foro de eleição em comarca distante da situação do condomínio sem justificativa.
3. VALIDAÇÃO DE CLÁUSULAS CONFORMES (PONTOS POSITIVOS):
   - Identifique e destaque as cláusulas protetivas presentes no instrumento que atendem com excelência aos padrões de governança.

FORMATO DA RESPOSTA:
Devolva APENAS um JSON válido, sem qualquer markdown envolvente ou texto introdutório:
{
  "resumo": "1 a 2 parágrafos executivos objetivos destacando o objeto, prestador e o resultado do confronto do instrumento com os modelos e parâmetros de referência.",
  "pontos_positivos": [{ "titulo": "...", "detalhe": "...", "clausula": "3ª"|null }],
  "pontos_negativos": [{ "titulo": "...", "detalhe": "...", "clausula": "..."|null }],
  "pontos_atencao": [{ "titulo": "...", "detalhe": "...", "clausula": "..."|null }],
  "modelos_comparados": ["Título do Modelo A", "Orientação B"]
}

REGRAS COMPLEMENTARES:
- Mantenha tom formal, elegante e fundamentado na técnica jurídica condominial.
- Nunca invente cláusulas. Se não localizar o número da cláusula de origem no contrato analisado, use null.
- Máximo de 8 itens por bloco.`;

    const userPrompt = [
      `DADOS DO CONTRATO ANALISADO:`,
      `- Prestador: "${c.prestador_nome}"`,
      `- Tipo de Serviço: "${tipoNome ?? "Prestação de Serviços em Geral"}"`,
      ``,
      temBasePrivada
        ? `REFERÊNCIAS DA BASE DE CONHECIMENTO PRIVADA ("TREINAR A IA" — PADRÃO-OURO):\n${contextoTexto}\n\n`
        : ``,
      `TEXTO INTEGRAL DO CONTRATO SUBMETIDO PELO PRESTADOR PARA ANÁLISE:\n${cortado}`,
    ].join("\n");

    const resp = await fetch(AIG_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Limite temporário atingido. Aguarde alguns minutos e tente novamente.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Reabasteça em Conta → Assinatura para continuar.");
      throw new Error(`Falha na análise: ${resp.status} — ${body.slice(0, 200)}`);
    }

    const payload = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const conteudo = payload.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonLoose(conteudo) as Record<string, unknown>;

    const modelosExtraidos = Array.isArray(parsed.modelos_comparados) && parsed.modelos_comparados.length > 0
      ? (parsed.modelos_comparados as unknown[]).map(String)
      : modelosComparados;

    const resultado: ResultadoAnalise = {
      resumo: typeof parsed.resumo === "string" ? parsed.resumo.slice(0, 4000) : null,
      pontos_positivos: normalizarPontos(parsed.pontos_positivos),
      pontos_negativos: normalizarPontos(parsed.pontos_negativos),
      pontos_atencao: normalizarPontos(parsed.pontos_atencao),
      modelos_comparados: modelosExtraidos,
      base_treinamento_utilizada: temBasePrivada,
      gerado_em: new Date().toISOString(),
      modelo: MODEL,
    };

    const { error: eUp } = await context.supabase
      .from("contratos_servico")
      .update({
        analise_resultado: resultado as never,
        analise_em: resultado.gerado_em,
      } as never)
      .eq("id", data.contratoId);
    if (eUp) throw new Error(eUp.message);

    // Registro de uso (não bloqueia).
    try {
      await registrarEventoIa({
        userId: context.userId,
        condominioId: c.condominio_id as string,
        origem: "outro",
        model: MODEL,
        tokensInput: payload.usage?.prompt_tokens ?? Math.ceil((cortado.length + contextoTexto.length) / 4),
        tokensOutput: payload.usage?.completion_tokens ?? Math.ceil(conteudo.length / 4),
        meta: {
          feature: "analise_contrato_servico_kb_benchmark",
          contrato_id: data.contratoId,
          base_treinamento_utilizada: temBasePrivada,
          modelos_comparados_count: modelosExtraidos.length,
        },
      });
    } catch (e) {
      console.warn("[analise] registrar uso:", (e as Error).message);
    }

    return resultado;
  });

export const getAnaliseContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { data: row, error } = await context.supabase
      .from("contratos_servico")
      .select("analise_resultado, analise_em")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      resultado: (row?.analise_resultado ?? null) as ResultadoAnalise | null,
      gerado_em: (row?.analise_em ?? null) as string | null,
    };
  });