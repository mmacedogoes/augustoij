/**
 * Análise contratual com semáforo (Fase 6, Parte C).
 *
 * Extrai o texto do arquivo do contrato (bucket `contratos` ou `documentos`
 * quando o contrato veio do acervo), envia para a IA e devolve três blocos
 * — pontos positivos, negativos e de atenção — persistindo o resultado em
 * `contratos_servico.analise_resultado`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";
import { registrarEventoIa } from "@/lib/uso-ia.server";

const MODEL = "google/gemini-2.5-flash";
const AIG_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type PontoAnalise = { titulo: string; detalhe: string; clausula?: string | null };
export type ResultadoAnalise = {
  pontos_positivos: PontoAnalise[];
  pontos_negativos: PontoAnalise[];
  pontos_atencao: PontoAnalise[];
  resumo: string | null;
  gerado_em: string;
  modelo: string;
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

export const analisarContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

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

    const system = `Você é um assistente jurídico brasileiro que revisa CONTRATOS DE PRESTAÇÃO DE SERVIÇOS firmados por CONDOMÍNIOS EDILÍCIOS. Devolva APENAS um JSON válido, sem markdown.

FORMATO:
{
  "resumo": "1-2 parágrafos objetivos sobre o contrato.",
  "pontos_positivos": [{ "titulo": "...", "detalhe": "...", "clausula": "3ª"|null }],
  "pontos_negativos": [{ "titulo": "...", "detalhe": "...", "clausula": "..."|null }],
  "pontos_atencao": [{ "titulo": "...", "detalhe": "...", "clausula": "..."|null }]
}

REGRAS:
- Objetividade, sem enrolação. Cada ponto no máximo 3 linhas.
- Nunca invente cláusulas. Se não localizar a cláusula, use null.
- Pontos positivos: cláusulas protetivas ao condomínio.
- Pontos negativos: cláusulas que expõem o condomínio a risco/desvantagem.
- Pontos de atenção: pontos que exigem verificação pelo síndico/advogado.
- Máximo de 8 itens por bloco.`;

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
          {
            role: "user",
            content: `Contrato firmado pelo condomínio com o prestador "${c.prestador_nome}". Segue o texto integral do contrato:\n\n${cortado}`,
          },
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

    const resultado: ResultadoAnalise = {
      resumo: typeof parsed.resumo === "string" ? parsed.resumo.slice(0, 4000) : null,
      pontos_positivos: normalizarPontos(parsed.pontos_positivos),
      pontos_negativos: normalizarPontos(parsed.pontos_negativos),
      pontos_atencao: normalizarPontos(parsed.pontos_atencao),
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
        tokensInput: payload.usage?.prompt_tokens ?? Math.ceil(cortado.length / 4),
        tokensOutput: payload.usage?.completion_tokens ?? Math.ceil(conteudo.length / 4),
        meta: { feature: "analise_contrato_servico", contrato_id: data.contratoId },
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