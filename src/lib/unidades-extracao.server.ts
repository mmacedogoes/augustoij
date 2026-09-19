import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoriaMeta, normalizeCategoria } from "@/lib/categorias-condominio";
import {
  detectarEscalaFracoes,
  dentroTolerancia,
  extrairNumerais,
  fracaoNaFaixa,
  inferirEscalaLiteral,
  normalizarFracao,
  numeroBrasileiro,
  type EscalaFracao,
} from "./fracao-normalizar";
import {
  construirCenso,
  resolverIdentidade,
  identificadorDaLinha,
  type Conhecida,
  type LinhaCenso,
} from "./censo-linhas";
import {
  interpretarConvencaoDescritiva,
  type BalancoDescritivo,
  type Conferencia,
  type LeituraDescritiva,
  type TentativaDescritiva,
} from "./convencao-descritiva";
import { carregarTextoIntegral } from "./extracao/fonte";
import { segmentarRegistros, type RegistroUnidade } from "./extracao/segmentador";
import { gerarChaveIdentidade } from "./extracao/ancoras";
import { converterNumeroOuExtenso } from "./extracao/rotulos";

export const CampoMedidaSchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return "indeterminado";
    const allowed = [
      "area_privativa",
      "area_terreno",
      "area_comum",
      "area_global",
      "area_equivalente",
      "area_garagem",
      "area_construcao",
      "cota_terreno",
      "fracao_terreno",
      "fracao_coisas_comuns",
      "coeficiente_rateio",
      "indeterminado",
    ];
    return allowed.includes(val) ? val : "indeterminado";
  },
  z.enum([
    "area_privativa",
    "area_terreno",
    "area_comum",
    "area_global",
    "area_equivalente",
    "area_garagem",
    "area_construcao",
    "cota_terreno",
    "fracao_terreno",
    "fracao_coisas_comuns",
    "coeficiente_rateio",
    "indeterminado",
  ])
);

export const EscalaMedidaSchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return "decimal";
    const allowed = ["percentual", "decimal", "milesimo", "fracao_ordinaria", "m2"];
    return allowed.includes(val) ? val : "decimal";
  },
  z.enum([
    "percentual",
    "decimal",
    "milesimo",
    "fracao_ordinaria",
    "m2",
  ])
);

export const MedidaExtraidaSchema = z.object({
  campo: CampoMedidaSchema,
  valor_bruto: z.string().min(1),
  escala: EscalaMedidaSchema,
  /** Preenchido pelo servidor quando a IA devolve apenas `linha_id`. */
  trecho: z.string().default(""),
  linha_id: z.string().nullable().optional(),
  pagina: z.number().int().positive().nullable().optional(),
  bloco: z.number().int().min(0).nullable().optional(),
  fonte: z.string().nullable().optional(),
  /** Título "BLOCO A"/"TORRE B" vigente acima da linha do quadro. */
  bloco_contexto: z.string().nullable().optional(),
});

export const MedidaDescartadaSchema = z.object({
  medida: MedidaExtraidaSchema,
  motivo: z.enum(["escala_invalida", "identidade_nao_confere", "valor_nao_confere"]),
});


const UnidadeExtraidaSchema = z.object({
  bloco: z.string().nullable().optional(),
  numero: z.string().min(1),
  tipo: z
    .preprocess(
      (val) => {
        if (typeof val !== "string") return "outro";
        const t = val.toLowerCase().trim();
        const allowed = ["apartamento", "casa", "lote", "terreno", "sala_comercial", "loja", "galpao", "vaga_avulsa", "outro"];
        return allowed.includes(t) ? t : "outro";
      },
      z
        .enum([
          "apartamento",
          "casa",
          "lote",
          "terreno",
          "sala_comercial",
          "loja",
          "galpao",
          "vaga_avulsa",
          "outro",
        ])
        .optional(),
    ),
  vagas_garagem: z.preprocess(
    (val) => (val == null || val === "" ? undefined : Number(val)),
    z.number().int().min(0).max(50).optional(),
  ),
  linha_id: z.string().nullable().optional(),
  medidas: z.preprocess(
    (val) => {
      if (Array.isArray(val)) {
        return val.filter(m => MedidaExtraidaSchema.safeParse(m).success);
      }
      return [];
    },
    z.array(MedidaExtraidaSchema)
  ).default([]),
  fonte: z.string().nullable().optional(),
  // Compatibilidade somente de leitura com sugestões antigas.
  fracao_ideal: z.number().positive().nullable().optional(),
  area_m2: z.number().positive().nullable().optional(),
  fracao_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  area_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  fracao_trecho: z.string().nullable().optional(),
  area_trecho: z.string().nullable().optional(),
  confianca: z.enum(["alta", "media", "conflito"]).optional(),
  estado: z.enum(["lido", "lido_com_ressalva", "nao_lido"]).optional(),
  origem: z.enum(["rotulo", "ia", "manual", "ausente"]).optional(),
  motivos: z.array(z.string()).optional(),
  trecho_fonte: z.string().nullable().optional(),
  candidatos: z.record(z.string(), z.array(MedidaExtraidaSchema)).optional(),
  medidas_descartadas: z.array(MedidaDescartadaSchema).optional(),
  regras_aplicadas: z.array(z.string()).optional(),
});

export type UnidadeExtraida = z.infer<typeof UnidadeExtraidaSchema>;

export type DiagnosticoExtracao = {
  total_declarado_no_texto?: number | null;
  quadro_fracoes_encontrado?: boolean | null;
  observacao?: string | null;
  total_trechos?: number;
  linhas_antes_normalizacao?: number;
  linhas_apos_normalizacao?: number;
  trechos_selecionados?: number;
  prefiltro?: string | null;
  linhas_do_quadro?: number;
  chamadas_ia?: number;
  chamadas_em_cache?: number;
  tokens_input?: number;
  tokens_output?: number;
  duracao_ms?: number;
  total_lotes?: number;
  lotes_processados?: number;
  lotes_com_erro?: number;
  unidades_encontradas?: number;
  unidades_com_fracao?: number;
  unidades_com_area?: number;
  conflitos?: string[];
  erros?: string[];
  escala_fracao?: EscalaFracao | null;
  somas_hipoteses?: Record<string, number>;
  regra_area?: string | null;
  medidas_descartadas?: Record<string, number>;
  validacoes?: Array<{
    regra: string;
    ok: boolean;
    valor?: number | null;
    unidades?: string[];
    detalhe?: string;
  }>;
  unidades_confianca_alta?: number;
  unidades_pendentes_revisao?: number;
  /** Balanço da invariante 4 — o total só pode diminuir com registro. */
  balanco?: {
    linhas_candidatas: number;
    lidas_pelo_parser: number;
    lidas_pela_ia: number;
    nao_lidas: number;
    unidades_resolvidas: number;
    sem_correspondencia: number;
    soma_fracoes: number;
    fecha: boolean;
  };
  linhas_nao_lidas?: Array<{ linha_id: string; texto: string; pagina: number | null }>;
  orfas?: Array<{
    numero: string;
    bloco: string | null;
    texto: string;
    pagina: number | null;
    linha_id: string | null;
  }>;
  /** Caminho de leitura efetivamente usado. */
  leitura?: "secao_descritiva" | "quadro_ia";
  /** As quatro conferências da seção descritiva. */
  conferencias?: Conferencia[];
  balanco_descritivo?: BalancoDescritivo;
  /** A tentativa de leitura descritiva — registrada SEMPRE, deu certo ou não. */
  tentativa_descritiva?: TentativaDescritiva;
  rol_artigo_2?: { total_declarado: number | null; identificadores: string[] } | null;
  /** Fonte do texto usada na extração. */
  fonte?: "storage_md" | "reconstruido_md" | "fallback_chunks" | string;
  total_paginas?: number;
  total_caracteres?: number;
  tipologia_detectada?: string | null;
  tipologia_divergente?: {
    cadastrada: string;
    detectada: string;
    mensagem?: string;
  } | null;
  lotes_pendentes?: Array<{ lote: number; motivo: string; texto?: string }>;
  registros_bloco_individual?: number;
  registros_bloco_grupo?: number;
};

export class ErroTimeoutIA extends Error {
  timeoutMs: number;
  constructor(timeoutMs: number, message?: string) {
    super(message ?? `A chamada à IA excedeu o tempo limite de ${timeoutMs}ms.`);
    this.name = "ErroTimeoutIA";
    this.timeoutMs = timeoutMs;
  }
}

export class ErroTruncadoIA extends Error {
  constructor(message = "A resposta da IA foi truncada; o lote será dividido em partes menores.") {
    super(message);
    this.name = "ErroTruncadoIA";
  }
}

type ChunkRow = {
  id: string;
  conteudo: string;
  metadata: {
    bloco?: number;
    trecho?: number;
    ordem_global?: number;
    pagina_inicio?: number;
    pagina_fim?: number;
  } | null;
};

type ChamadaIA = {
  data: unknown;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  aigLogId: string | null;
  aigRunId: string | null;
};

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ancorasRaw from "./extracao/ancoras?raw";
import segmentadorRaw from "./extracao/segmentador?raw";
import rotulosRaw from "./extracao/rotulos?raw";

const MODELO = "google/gemini-2.5-flash";
const TAMANHO_LOTE = 8_000;
export const CONCORRENCIA = 4;
export const TIMEOUT_CHAMADA = 30_000;
export const DEFAULT_ORCAMENTO_MS = 50_000;
const MAX_TENTATIVAS = 3;

export const PROMPT_SISTEMA_BASE =
  "Você está lendo o trecho de uma CONVENÇÃO DE CONDOMÍNIO brasileira que descreve UMA unidade autônoma já identificada. Sua tarefa é transcrever as medidas dessa unidade, não interpretá-las.\n\n" +
  "O que cada campo significa neste documento:\n" +
  "- area_privativa: a área de uso exclusivo do proprietário. Aparece como 'Área Real de Uso Privativo', 'Área Privativa', 'Área Real Privativa', 'Área de construção privativa real', 'Área Útil'. É a área da unidade.\n" +
  "- area_comum: a parte das áreas comuns atribuída à unidade ('Área de Uso Comum Real', 'Área Real de Uso Comum').\n" +
  "- area_garagem: área de garagem ou vaga, ainda que escrita como área comum de divisão não proporcional.\n" +
  "- area_total: a soma da privativa com a comum ('Área Real Total', 'Área Global').\n" +
  "- area_construcao: 'Área da Unidade (de construção)'. NÃO é a área privativa.\n" +
  "- area_terreno: área do terreno ou do lote, em loteamentos.\n" +
  "- cota_terreno: 'Cota Ideal do Terreno', em m². NÃO é a fração ideal.\n" +
  "- fracao_ideal: a fração ideal do terreno e das coisas comuns. Número entre 0 e 1, ou percentual, ou milésimos, ou fração ordinária.\n" +
  "- vagas: quantidade de vagas de garagem, inclusive por extenso ('duas vagas' = 2).\n\n" +
  "Regras: transcreva valor_bruto exatamente como impresso, com vírgula decimal e símbolo. Não converta escalas, não calcule, não estime, não complete séries, não traga valor que não esteja escrito NESTE trecho. Campo ausente = null. Para cada valor, informe também o rótulo literal que você leu, em 'rotulo_lido' — é assim que conferimos a sua leitura.\n\n" +
  'Responda apenas JSON no formato: {"area_privativa":{"valor_bruto":string|null,"rotulo_lido":string|null},"area_comum":{"valor_bruto":string|null,"rotulo_lido":string|null},"area_garagem":{"valor_bruto":string|null,"rotulo_lido":string|null},"area_total":{"valor_bruto":string|null,"rotulo_lido":string|null},"area_construcao":{"valor_bruto":string|null,"rotulo_lido":string|null},"area_terreno":{"valor_bruto":string|null,"rotulo_lido":string|null},"cota_terreno":{"valor_bruto":string|null,"rotulo_lido":string|null},"fracao_ideal":{"valor_bruto":string|null,"rotulo_lido":string|null},"vagas":{"valor_bruto":string|null,"rotulo_lido":string|null}}.';

function obterConteudoArquivo(moduloRaw: string | undefined, nomeArquivo: string): string {
  if (typeof moduloRaw === "string" && moduloRaw.length > 0) {
    return moduloRaw;
  }
  try {
    const fullPath = path.resolve(process.cwd(), "src/lib/extracao", nomeArquivo);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
  } catch {
    // fallback seguro
  }
  return "";
}

export function calcularVersaoPipeline(): string {
  const cAncoras = obterConteudoArquivo(ancorasRaw, "ancoras.ts");
  const cSegmentador = obterConteudoArquivo(segmentadorRaw, "segmentador.ts");
  const cRotulos = obterConteudoArquivo(rotulosRaw, "rotulos.ts");

  const combinado = [
    cAncoras,
    cSegmentador,
    cRotulos,
    PROMPT_SISTEMA_BASE,
  ].join("\n---PIPELINE_HASH_SEPARATOR---\n");

  const hash = createHash("sha256").update(combinado).digest("hex").slice(0, 16);
  return `pipeline_${hash}`;
}

export const VERSAO_PROMPT = calcularVersaoPipeline();


export class ExtracaoIncompletaError extends Error {
  readonly codigo = "extracao_incompleta";
  readonly diagnostico: DiagnosticoExtracao;

  constructor(message: string, diagnostico: DiagnosticoExtracao = {}) {
    super(message);
    this.name = "ExtracaoIncompletaError";
    this.diagnostico = diagnostico;
  }
}

export function chaveUnidade(bloco: string | null, numero: string) {
  return `${normalizarParte(bloco ?? "")}|${normalizarParte(numero)}`;
}

function normalizarParte(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, tentativa: number) {
  const header = response.headers.get("retry-after");
  if (header) {
    const segundos = Number(header);
    if (Number.isFinite(segundos)) return Math.max(1_000, segundos * 1_000);
    const data = Date.parse(header);
    if (Number.isFinite(data)) return Math.max(1_000, data - Date.now());
  }
  return Math.min(8_000, 1_000 * 2 ** tentativa);
}

export function processarRespostaIA(
  data: unknown,
  lote: { id?: string; escopo?: string | null; numero?: string; texto: string },
  tipologia: string,
  candidatas: UnidadeExtraida[],
) {
  const parsed = data as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object") return;

  // Formato novo (Bloco 5): objeto único com campos de medidas
  if (
    "area_privativa" in parsed ||
    "area_comum" in parsed ||
    "area_garagem" in parsed ||
    "area_total" in parsed ||
    "fracao_ideal" in parsed
  ) {
    const medidas: z.infer<typeof MedidaExtraidaSchema>[] = [];
    let vagas: number | undefined = undefined;

    const camposMapeados: Array<[string, z.infer<typeof CampoMedidaSchema>, "m2" | "decimal"]> = [
      ["area_privativa", "area_privativa", "m2"],
      ["area_comum", "area_comum", "m2"],
      ["area_garagem", "area_garagem", "m2"],
      ["area_total", "area_global", "m2"],
      ["area_construcao", "area_construcao", "m2"],
      ["area_terreno", "area_terreno", "m2"],
      ["cota_terreno", "cota_terreno", "m2"],
      ["fracao_ideal", "fracao_terreno", "decimal"],
    ];

    for (const [chave, campo, escalaPadrao] of camposMapeados) {
      const item = parsed[chave] as { valor_bruto?: string | null; rotulo_lido?: string | null } | null | undefined;
      if (item && item.valor_bruto && typeof item.valor_bruto === "string" && item.valor_bruto.trim().length > 0) {
        medidas.push({
          campo,
          valor_bruto: item.valor_bruto.trim(),
          escala: escalaPadrao,
          trecho: item.rotulo_lido ? `${item.rotulo_lido} ${item.valor_bruto}` : item.valor_bruto,
          linha_id: lote.id,
          fonte: `ia ${lote.id ?? ""}`,
          bloco_contexto: lote.escopo ?? null,
        });
      }
    }

    const vagasItem = parsed["vagas"] as { valor_bruto?: string | null } | null | undefined;
    if (vagasItem && vagasItem.valor_bruto) {
      const vNum = converterNumeroOuExtenso(String(vagasItem.valor_bruto));
      if (vNum != null) vagas = vNum;
    }

    if (lote.numero) {
      const tipo = (tipologia === "casas_lotes" || (lote.texto && lote.texto.toLowerCase().includes("lote")))
        ? "lote"
        : ((lote.texto && lote.texto.toLowerCase().includes("casa")) ? "casa" : "apartamento");

      candidatas.push({
        bloco: lote.escopo ?? null,
        numero: lote.numero,
        tipo,
        vagas_garagem: vagas,
        linha_id: lote.id,
        medidas,
        medidas_descartadas: [],
        fonte: "ia_unitaria",
        regras_aplicadas: ["ia_unitaria"],
      });
    }
    return;
  }

  // Fallback para lista de unidades (mocks/testes legados)
  if (Array.isArray(parsed.unidades)) {
    for (const u of parsed.unidades) {
      const r = UnidadeExtraidaSchema.safeParse(u);
      if (r.success) candidatas.push(r.data);
    }
  }
}

export async function chamarIaJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { timeoutMs?: number } = {},
): Promise<ChamadaIA> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_CHAMADA;
  let ultimaMensagem = "Falha na comunicação com a IA.";
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          body: JSON.stringify({
            model: MODELO,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const isAbort =
        (error instanceof Error && (error.name === "AbortError" || /abort|timeout|timed out/i.test(error.message))) ||
        (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError");
      if (isAbort) {
        throw new ErroTimeoutIA(timeoutMs);
      }
      ultimaMensagem = error instanceof Error ? error.message : ultimaMensagem;
      if (tentativa === MAX_TENTATIVAS - 1) {
        throw new Error(`A leitura foi interrompida temporariamente: ${ultimaMensagem}`);
      }
      await sleep(Math.min(8_000, 1_000 * 2 ** tentativa));
      continue;
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      let mensagem = raw.slice(0, 500);
      try {
        const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
        mensagem = parsed.message ?? parsed.error?.message ?? mensagem;
      } catch {
        // O texto bruto já contém a melhor mensagem disponível.
      }
      ultimaMensagem = mensagem || `Falha na IA (${response.status})`;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(ultimaMensagem);
      }
      if (tentativa === MAX_TENTATIVAS - 1) throw new Error(ultimaMensagem);
      await sleep(retryAfterMs(response, tentativa));
      continue;
    }

    const aigLogId = response.headers.get("x-lovable-aig-log-id");
    const aigRunId = response.headers.get("x-lovable-aig-run-id");
    const json = (await response.json()) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = json.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new ErroTruncadoIA();
    }
    const raw = choice?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("A IA devolveu uma resposta vazia.");
    let data: unknown;
    try {
      data = JSON.parse(
        raw
          .replace(/^```json\s*/i, "")
          .replace(/```$/i, "")
          .trim(),
      );
    } catch {
      throw new Error("A IA devolveu JSON incompleto ou inválido.");
    }
    return {
      data,
      model: MODELO,
      usage: {
        prompt_tokens: json.usage?.prompt_tokens ?? 0,
        completion_tokens: json.usage?.completion_tokens ?? 0,
        total_tokens: json.usage?.total_tokens ?? 0,
      },
      aigLogId,
      aigRunId,
    };
  }

  throw new Error(`A leitura foi interrompida temporariamente: ${ultimaMensagem}`);
}

export function dividirTextoAoMeio(texto: string, tamanhoMinimo = 2_000): [string, string] | null {
  if (texto.length <= tamanhoMinimo) return null;
  const meio = Math.floor(texto.length / 2);
  const anterior = texto.lastIndexOf("\n", meio);
  const proxima = texto.indexOf("\n", meio);

  let pontoCorte = -1;
  if (anterior !== -1 && proxima !== -1) {
    pontoCorte = (meio - anterior <= proxima - meio) ? anterior : proxima;
  } else if (anterior !== -1) {
    pontoCorte = anterior;
  } else if (proxima !== -1) {
    pontoCorte = proxima;
  }

  if (pontoCorte <= 0 || pontoCorte >= texto.length - 1) {
    const espacoAnt = texto.lastIndexOf(" ", meio);
    const espacoProx = texto.indexOf(" ", meio);
    if (espacoAnt !== -1 && espacoProx !== -1) {
      pontoCorte = (meio - espacoAnt <= espacoProx - meio) ? espacoAnt : espacoProx;
    } else if (espacoAnt !== -1) {
      pontoCorte = espacoAnt;
    } else if (espacoProx !== -1) {
      pontoCorte = espacoProx;
    }
  }

  if (pontoCorte <= 0 || pontoCorte >= texto.length - 1) {
    return null;
  }

  const parte1 = texto.slice(0, pontoCorte).trim();
  const parte2 = texto.slice(pontoCorte + 1).trim();
  if (parte1.length === 0 || parte2.length === 0) return null;
  return [parte1, parte2];
}

function ordenarChunks(chunks: ChunkRow[]) {
  return chunks.slice().sort((a, b) => {
    const ma = a.metadata ?? {};
    const mb = b.metadata ?? {};
    const ordem =
      (ma.ordem_global ?? Number.MAX_SAFE_INTEGER) - (mb.ordem_global ?? Number.MAX_SAFE_INTEGER);
    if (ordem !== 0) return ordem;
    const bloco = (ma.bloco ?? Number.MAX_SAFE_INTEGER) - (mb.bloco ?? Number.MAX_SAFE_INTEGER);
    if (bloco !== 0) return bloco;
    const pagina =
      (ma.pagina_inicio ?? Number.MAX_SAFE_INTEGER) - (mb.pagina_inicio ?? Number.MAX_SAFE_INTEGER);
    if (pagina !== 0) return pagina;
    const trecho = (ma.trecho ?? Number.MAX_SAFE_INTEGER) - (mb.trecho ?? Number.MAX_SAFE_INTEGER);
    if (trecho !== 0) return trecho;
    return a.id.localeCompare(b.id);
  });
}

const REGEX_TITULO_BLOCO = /\b(?:bloco|torre|quadra)\s+([a-z0-9]{1,3})\b/i;
const temLinhaTabela = (texto: string) => /^\s*\|.*\|\s*$/m.test(texto);

export type LinhaLote = {
  texto: string;
  pagina: number | null;
  bloco: number | null;
  fonte: string;
  bloco_contexto: string | null;
};

export type Lote = {
  texto: string;
  fontes: string[];
  linhas: Record<string, LinhaLote>;
};

/**
 * Pontua cada trecho sem IA: só vai para o modelo o que pode conter unidade.
 * Vizinhos imediatos entram junto para não cortar a continuação de um quadro.
 */
export function selecionarChunksRelevantes<T extends { conteudo: string }>(chunks: T[]) {
  const pontuar = (texto: string) => {
    let pontos = 0;
    if (temLinhaTabela(texto)) pontos += 3;
    if (/fra[cç][aã]o ideal|[aá]rea privativa|quadro|coeficiente/i.test(texto)) pontos += 2;
    if (/^.*?\d+,\d+.*?\d+,\d+.*?\d+,\d+.*$/m.test(texto)) pontos += 2;
    if (/\b(?:unidade|apto\.?|apartamento|bloco|lote|sala|loja)\s*\d/i.test(texto)) pontos += 1;
    return pontos;
  };
  const marcados = chunks.map((c) => pontuar(c.conteudo) > 0);
  const selecionados = chunks.filter(
    (_, i) => marcados[i] || marcados[i - 1] === true || marcados[i + 1] === true,
  );
  if (selecionados.length === 0) return { chunks, prefiltro: "sem_sinal_caiu_para_documento" };
  return { chunks: selecionados, prefiltro: `selecionados ${selecionados.length}/${chunks.length}` };
}

export function montarLotes(chunks: ChunkRow[], tamanho = TAMANHO_LOTE): Lote[] {
  const ordenados = ordenarChunks(chunks);
  const lotes: Lote[] = [];
  let partes: string[] = [];
  let fontes: string[] = [];
  let linhas: Record<string, LinhaLote> = {};
  let contextoQuadro = "";
  let blocoContexto: string | null = null;
  let contador = 0;
  const cabecalho = (texto: string) => {
    const linhasTexto = texto.split("\n");
    const indice = linhasTexto.findIndex(
      (linha, i) =>
        /^\s*\|.*\|\s*$/.test(linha) && /^\s*\|?\s*:?-{3,}/.test(linhasTexto[i + 1] ?? ""),
    );
    if (indice < 0) return "";
    return linhasTexto.slice(Math.max(0, indice - 2), indice + 2).join("\n");
  };
  for (const chunk of ordenados) {
    const meta = chunk.metadata ?? {};
    const quadro = cabecalho(chunk.conteudo);
    if (quadro) contextoQuadro = quadro;
    // O cabeçalho do quadro só vale enquanto ainda houver tabela no trecho.
    else if (!temLinhaTabela(chunk.conteudo)) contextoQuadro = "";
    const ref = `bloco ${meta.bloco ?? "?"}, páginas ${meta.pagina_inicio ?? "?"}-${meta.pagina_fim ?? "?"}, trecho ${meta.trecho ?? "?"}, ordem ${meta.ordem_global ?? "?"}`;
    const contexto =
      contextoQuadro && !chunk.conteudo.includes(contextoQuadro)
        ? `\n[CONTEXTO DO QUADRO]\n${contextoQuadro}`
        : "";
    const numeradas: string[] = [];
    for (const linha of chunk.conteudo.split("\n")) {
      const titulo = REGEX_TITULO_BLOCO.exec(linha);
      if (titulo && !/^\s*\|/.test(linha)) blocoContexto = titulo[1].toUpperCase();
      if (!linha.trim()) continue;
      contador += 1;
      const id = `L${String(contador).padStart(4, "0")}`;
      numeradas.push(`${id}: ${linha}`);
      linhas[id] = {
        texto: linha.trim(),
        pagina: meta.pagina_inicio ?? null,
        bloco: meta.bloco ?? null,
        fonte: ref,
        bloco_contexto: blocoContexto,
      };
    }
    const parte = `${contexto}\n\n[FONTE: ${ref}; id ${chunk.id}${blocoContexto ? `; bloco_contexto ${blocoContexto}` : ""}]\n${numeradas.join("\n")}`;
    if (partes.length > 0 && partes.join("").length + parte.length > tamanho) {
      lotes.push({ texto: partes.join(""), fontes, linhas });
      partes = [];
      fontes = [];
      linhas = {};
    }
    partes.push(parte);
    fontes.push(ref);
  }
  if (partes.length) lotes.push({ texto: partes.join(""), fontes, linhas });
  return lotes;
}

/**
 * Monta lotes com LINHAS SOLTAS (as que ninguém leu), já numeradas pelo
 * `linha_id` estável do censo. É mais barato que reenviar trechos inteiros.
 */
export function montarLotesDeLinhas(linhas: LinhaCenso[], tamanho = TAMANHO_LOTE): Lote[] {
  const lotes: Lote[] = [];
  let partes: string[] = [];
  let fontes: string[] = [];
  let mapa: Record<string, LinhaLote> = {};
  let tamanhoAtual = 0;
  for (const linha of linhas) {
    const parte = `${linha.linha_id}${linha.bloco_contexto ? ` [bloco ${linha.bloco_contexto}]` : ""}: ${linha.texto}`;
    if (partes.length > 0 && tamanhoAtual + parte.length > tamanho) {
      lotes.push({ texto: partes.join("\n"), fontes, linhas: mapa });
      partes = [];
      fontes = [];
      mapa = {};
      tamanhoAtual = 0;
    }
    partes.push(parte);
    tamanhoAtual += parte.length + 1;
    if (!fontes.includes(linha.fonte)) fontes.push(linha.fonte);
    mapa[linha.linha_id] = {
      texto: linha.texto,
      pagina: linha.pagina,
      bloco: linha.bloco,
      fonte: linha.fonte,
      bloco_contexto: linha.bloco_contexto,
    };
  }
  if (partes.length) lotes.push({ texto: partes.join("\n"), fontes, linhas: mapa });
  return lotes;
}


function escaparRegex(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Colapsa separadores de tabela para que o layout não interfira no casamento. */
function normalizarTrecho(trecho: string) {
  return trecho
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[|\t]+/g, " ")
    .replace(/\s{2,}/g, " ");
}

const ABREV_UNIDADE = "(?:unid\\.?|un\\.?|ap\\.?|apto\\.?|apartamento|unidade|casa|sala|loja|lote)?\\s*";
const ABREV_BLOCO = "(?:bl\\.?|bloco|torre|qd\\.?|quadra)?\\s*";

export function trechoContemIdentidade(
  unidade: Pick<UnidadeExtraida, "bloco" | "numero">,
  trecho: string | null | undefined,
  blocoContexto?: string | null,
) {
  if (!trecho) return false;
  const numero = escaparRegex(normalizarParte(unidade.numero));
  const bloco = escaparRegex(normalizarParte(unidade.bloco ?? ""));
  const texto = normalizarTrecho(trecho);
  const numeroNaLinha = new RegExp(`(?<![0-9])${numero}(?![0-9])`, "i").test(texto);
  if (!bloco) return numeroNaLinha;
  // O bloco pode vir de um título acima da tabela, não da própria linha.
  if (numeroNaLinha && normalizarParte(blocoContexto ?? "") === bloco) return true;
  const padroes = [
    `(?<![0-9])${numero}(?![0-9])[\\s\\-–—/,.]*${ABREV_BLOCO}(?<![a-z])${bloco}(?![a-z])`,
    `${ABREV_BLOCO}(?<![a-z])${bloco}(?![a-z])[\\s\\-–—/,.]*${ABREV_UNIDADE}(?<![0-9])${numero}(?![0-9])`,
    `(?<![0-9])${numero}(?![0-9])\\s+(?:do|da)\\s+(?:bloco|torre|quadra)\\s+${bloco}(?![a-z])`,

  ];
  return padroes.some((padrao) => new RegExp(padrao, "i").test(texto));
}

function valorApareceNoTrecho(medida: z.infer<typeof MedidaExtraidaSchema>) {
  // A comparação é NUMÉRICA com tolerância: a transcrição literal pode
  // divergir por espaço do OCR ou por ponto/vírgula.
  const alvo =
    medida.escala === "m2"
      ? numeroBrasileiro(medida.valor_bruto)
      : normalizarFracao(medida.valor_bruto, medida.escala as EscalaFracao);
  if (alvo == null) return false;
  const trechoLimpo = medida.trecho.replace(/(\d)\s+(\d)/g, "$1$2");
  return extrairNumerais(trechoLimpo).some((literal) => {
    if (medida.escala === "m2") {
      const valor = numeroBrasileiro(literal);
      return valor != null && dentroTolerancia(valor, alvo, 0.02);
    }
    const escala = inferirEscalaLiteral(literal) ?? (medida.escala as EscalaFracao);
    const valor = normalizarFracao(literal, escala);
    return valor != null && dentroTolerancia(valor, alvo, 1e-6);
  });
}

/** Nunca apaga em silêncio: reprovadas vão para `medidas_descartadas` com o motivo. */
function validarProveniencia(
  unidade: UnidadeExtraida,
  censo: { porId: Map<string, { pagina: number | null; texto?: string }> },
  registros?: RegistroUnidade[],
) {
  const medidas: UnidadeExtraida["medidas"] = [];
  const descartadas: NonNullable<UnidadeExtraida["medidas_descartadas"]> = [
    ...(unidade.medidas_descartadas ?? []),
  ];

  // 1) Localiza o registro da unidade pela identidade `${escopo ?? ""}|${numero}`
  const chave = gerarChaveIdentidade(unidade.numero, null, unidade.bloco ?? null);
  const registro = registros?.find((r) => {
    const chaveReg = gerarChaveIdentidade(r.numero, r.sufixo, r.escopo);
    const chaveRegSemSufixo = gerarChaveIdentidade(r.numero, null, r.escopo);
    return (
      chaveReg === chave ||
      chaveRegSemSufixo === chave ||
      (r.numero === unidade.numero && (unidade.bloco == null || r.escopo === unidade.bloco))
    );
  });

  // Página onde a linha principal da unidade foi identificada
  const paginaUnidade = unidade.linha_id
    ? (censo.porId.get(unidade.linha_id)?.pagina ?? null)
    : (registro?.pagina ?? null);

  // Para cada medida sem trecho, preenche com o texto e página do registro
  if (registro) {
    for (const medida of unidade.medidas ?? []) {
      if (!medida.trecho || medida.trecho.trim() === "") {
        medida.trecho = registro.texto;
        medida.pagina = registro.pagina;
        if (!medida.bloco_contexto && (registro.escopo || unidade.bloco)) {
          medida.bloco_contexto = registro.escopo ?? unidade.bloco;
        }
      }
    }
  }

  let temMedidaSemProveniencia = false;

  for (const medida of unidade.medidas ?? []) {
    const trecho = (medida.trecho ?? "").trim();

    // Caso 1: NÃO existe trecho nenhum (nem da medida, nem do registro) -> NÃO rejeite!
    if (!trecho) {
      medidas.push(medida);
      temMedidaSemProveniencia = true;
      continue;
    }

    // Caso 2: Existe trecho e o valor numérico NÃO aparece nele -> rejeita com "valor_nao_confere"
    if (!valorApareceNoTrecho(medida)) {
      descartadas.push({ medida, motivo: "valor_nao_confere" });
      continue;
    }

    // Se a medida veio do registro segmentado da própria unidade, o trecho já pertence a ela
    if (
      registro &&
      (medida.linha_id === registro.registro_id ||
        registro.texto.includes(medida.trecho) ||
        medida.trecho === registro.texto ||
        medida.trecho.trim() === registro.texto.trim())
    ) {
      medidas.push(medida);
      continue;
    }

    // Regra 2 (prosa vs bloco para outras fontes de trecho):
    if (unidade.bloco) {
      // Documento tabular — aplica a regra estrita de identidade
      if (!trechoContemIdentidade(unidade, medida.trecho, medida.bloco_contexto)) {
        descartadas.push({ medida, motivo: "identidade_nao_confere" });
        continue;
      }
    } else {
      // Documento proseado — aceitar medidas na mesma página da unidade
      const paginaMedida =
        medida.pagina ??
        (medida.linha_id ? (censo.porId.get(medida.linha_id)?.pagina ?? null) : null);
      if (paginaUnidade !== null && paginaMedida !== null && paginaMedida !== paginaUnidade) {
        // Medida de outra página — descarta
        descartadas.push({ medida, motivo: "identidade_nao_confere" });
        continue;
      }
    }
    medidas.push(medida);
  }

  const regrasAplicadas = [...(unidade.regras_aplicadas ?? [])];
  const motivos = [...(unidade.motivos ?? [])];
  let estado = unidade.estado;

  if (temMedidaSemProveniencia) {
    if (!regrasAplicadas.includes("sem_proveniencia")) {
      regrasAplicadas.push("sem_proveniencia");
    }
    if (!motivos.includes("sem_proveniencia")) {
      motivos.push("sem_proveniencia");
    }
    estado = "lido_com_ressalva";
  }

  return {
    ...unidade,
    medidas,
    medidas_descartadas: descartadas,
    regras_aplicadas: regrasAplicadas,
    motivos,
    estado,
  };
}


export function normalizarParaCadastro(
  unidade: UnidadeExtraida,
  conhecidas: Array<{ bloco: string | null; numero: string }>,
) {
  const direto = conhecidas.find(
    (item) =>
      chaveUnidade(item.bloco, item.numero) === chaveUnidade(unidade.bloco ?? null, unidade.numero),
  );
  if (direto) return { ...unidade, bloco: direto.bloco, numero: direto.numero };

  const numeroComBloco = normalizarParte(unidade.numero);
  const porComposto = conhecidas.filter((item) => {
    const numeroBloco = normalizarParte(`${item.numero}${item.bloco ?? ""}`);
    const blocoNumero = normalizarParte(`${item.bloco ?? ""}${item.numero}`);
    return numeroBloco === numeroComBloco || blocoNumero === numeroComBloco;
  });
  return porComposto.length === 1
    ? { ...unidade, bloco: porComposto[0].bloco, numero: porComposto[0].numero }
    : unidade;
}

type Medida = z.infer<typeof MedidaExtraidaSchema>;
type CampoMedida = z.infer<typeof CampoMedidaSchema>;

function valorCanonico(medida: Medida, escalaGlobal: EscalaFracao | null) {
  if (medida.escala === "m2") return numeroBrasileiro(medida.valor_bruto);
  const explicita = inferirEscalaLiteral(medida.valor_bruto);
  return normalizarFracao(
    medida.valor_bruto,
    explicita ?? escalaGlobal ?? (medida.escala as EscalaFracao),
  );
}

function precedenciaFonte(medida: Medida) {
  const texto = `${medida.fonte ?? ""} ${medida.trecho}`.toLowerCase();
  return (
    (/anexo/.test(texto) ? 4 : 0) +
    (/quadro|tabela|\|/.test(texto) ? 2 : 0) +
    (/art\.|artigo|paragrafo/.test(texto) ? 0 : 1)
  );
}

const CAMPOS_FRACAO: CampoMedida[] = [
  "fracao_terreno",
  "coeficiente_rateio",
  "fracao_coisas_comuns",
];

export function resolverValorComEvidencia(
  medidas: Medida[],
  campo: CampoMedida,
  escalaGlobal: EscalaFracao | null,
  coerentes = new Set<Medida>(),
) {
  const invalidas: Medida[] = [];
  const ehFracao = CAMPOS_FRACAO.includes(campo);
  const candidatas = medidas
    .filter((medida) => medida.campo === campo)
    .map((medida) => ({ medida, valor: valorCanonico(medida, escalaGlobal) }))
    .filter((item): item is { medida: Medida; valor: number } => {
      if (item.valor == null) {
        invalidas.push(item.medida);
        return false;
      }
      // A faixa só é cobrada DEPOIS de escolhida a escala global.
      if (ehFracao && !fracaoNaFaixa(item.valor)) {
        invalidas.push(item.medida);
        return false;
      }
      return true;
    });
  if (candidatas.length === 0)
    return { medida: null, valor: null, conflito: false, candidatas: [] as Medida[], invalidas };
  const absoluto = campo.startsWith("area_") ? 0.02 : 1e-6;
  const grupos: Array<Array<(typeof candidatas)[number]>> = [];
  for (const candidata of candidatas) {
    const grupo = grupos.find((itens) =>
      dentroTolerancia(itens[0].valor, candidata.valor, absoluto),
    );
    if (grupo) grupo.push(candidata);
    else grupos.push([candidata]);
  }
  const ranking = grupos
    .map((grupo) => ({
      grupo,
      aritmetica: grupo.filter(({ medida }) => coerentes.has(medida)).length,
      fonte: Math.max(...grupo.map(({ medida }) => precedenciaFonte(medida))),
      maioria: grupo.length,
    }))
    .sort(
      (a, b) =>
        b.aritmetica - a.aritmetica ||
        b.fonte - a.fonte ||
        b.maioria - a.maioria ||
        a.grupo[0].valor - b.grupo[0].valor,
    );
  const primeira = ranking[0];
  const segunda = ranking[1];
  const empate =
    segunda &&
    primeira.aritmetica === segunda.aritmetica &&
    primeira.fonte === segunda.fonte &&
    primeira.maioria === segunda.maioria;
  return {
    medida: empate ? null : primeira.grupo[0].medida,
    valor: empate ? null : primeira.grupo[0].valor,
    conflito: Boolean(empate),
    candidatas: candidatas.map(({ medida }) => medida),
    invalidas,
  };
}

function detectarEscalaGlobal(grupos: Map<string, UnidadeExtraida[]>) {
  const valores: string[] = [];
  for (const [, candidatas] of [...grupos.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  )) {
    const medidas = candidatas
      .flatMap((item) => item.medidas)
      // A amostra precisa incluir todas as medidas de fração — inclusive as
      // rotuladas como indeterminado — senão o somatório nunca fecha.
      .filter(
        (medida) =>
          CAMPOS_FRACAO.includes(medida.campo) ||
          (medida.campo === "indeterminado" && medida.escala !== "m2"),
      )
      .sort(
        (a, b) =>
          a.campo.localeCompare(b.campo) ||
          a.valor_bruto.localeCompare(b.valor_bruto, "pt-BR", { numeric: true }),
      );
    const contagens = new Map<string, { medida: Medida; total: number }>();
    for (const medida of medidas) {
      const chave = `${medida.campo}|${medida.valor_bruto}`;
      const atual = contagens.get(chave);
      contagens.set(chave, { medida, total: (atual?.total ?? 0) + 1 });
    }
    const unica = [...contagens.values()].sort(
      (a, b) =>
        b.total - a.total ||
        a.medida.valor_bruto.localeCompare(b.medida.valor_bruto, "pt-BR", { numeric: true }),
    )[0]?.medida;
    if (unica) valores.push(unica.valor_bruto);
  }
  return detectarEscalaFracoes(valores);
}

export function consolidar(
  candidatas: UnidadeExtraida[],
  conhecidas: Array<{ bloco: string | null; numero: string }>,
  censo: { porId: Map<string, { pagina: number | null; texto?: string }> } = { porId: new Map() },
  registros?: RegistroUnidade[],
  tipologia?: string,
) {
  const grupos = new Map<string, UnidadeExtraida[]>();
  const orfas: NonNullable<DiagnosticoExtracao["orfas"]> = [];
  for (const bruta of candidatas) {
    const referencia = bruta.medidas?.find((m) => m.bloco_contexto || m.linha_id);
    const identidade = resolverIdentidade(
      {
        bloco: bruta.bloco ?? null,
        numero: bruta.numero,
        bloco_contexto: bruta.medidas?.find((m) => m.bloco_contexto)?.bloco_contexto ?? null,
      },
      conhecidas as Conhecida[],
    );
    if (identidade.status === "sem_correspondencia") {
      // Nunca cria chave nova e nunca agrupa: vai para a revisão como órfã.
      orfas.push({
        numero: bruta.numero,
        bloco: bruta.bloco ?? null,
        texto: referencia?.trecho ?? bruta.medidas?.[0]?.trecho ?? "",
        pagina: referencia?.pagina ?? null,
        linha_id: referencia?.linha_id ?? null,
      });
      continue;
    }
    const atualizada = validarProveniencia(
      {
        ...bruta,
        bloco: identidade.bloco,
        numero: identidade.numero,
        regras_aplicadas: [...(bruta.regras_aplicadas ?? []), identidade.regra],
      },
      censo,
      registros,
    );
    const key = chaveUnidade(atualizada.bloco ?? null, atualizada.numero);
    grupos.set(key, [...(grupos.get(key) ?? []), atualizada]);
  }
  const escala = detectarEscalaGlobal(grupos);
  const conflitos: string[] = [];
  const regrasGlobais = new Set<string>();

  // Trava para promoção de indeterminado a área:
  // só promove se NENHUMA unidade no documento inteiro tiver area_privativa ou area_terreno identificada.
  const documentoTemAreaPrivativa = [...grupos.values()].some((grupo) =>
    grupo.some((u) =>
      u.medidas.some(
        (m) =>
          (m.campo === "area_privativa" || m.campo === "area_terreno") &&
          valorCanonico(m, escala.escala) != null,
      ),
    ),
  );

  const parciais = [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
    .map(([key, grupo]) => {
      const base = grupo[0];
      const medidas = grupo.flatMap((item) => item.medidas);
      const descartadas = grupo.flatMap((item) => item.medidas_descartadas ?? []);
      const regras: string[] = [];
      const coerentes = new Set<Medida>();
      for (const global of medidas.filter((m) => m.campo === "area_global")) {
        const vg = valorCanonico(global, escala.escala);
        const priv = medidas.find((m) => m.campo === "area_privativa");
        const comum = medidas.find((m) => m.campo === "area_comum");
        const vp = priv ? valorCanonico(priv, escala.escala) : null;
        const vc = comum ? valorCanonico(comum, escala.escala) : null;
        if (vg != null && vp != null && vc != null && dentroTolerancia(vg, vp + vc, 0.05)) {
          coerentes.add(global);
          if (priv) coerentes.add(priv);
          if (comum) coerentes.add(comum);
          if (dentroTolerancia(vg, vp + vc, 0.02)) {
            regras.push("area_total_conferida_com_comum");
          }
        }
      }
      const registrarInvalidas = (lista: Medida[]) => {
        for (const medida of lista) descartadas.push({ medida, motivo: "escala_invalida" });
      };
      const privativa = resolverValorComEvidencia(
        medidas,
        "area_privativa",
        escala.escala,
        coerentes,
      );
      const terrenoArea = resolverValorComEvidencia(
        medidas,
        "area_terreno",
        escala.escala,
        coerentes,
      );
      const global = resolverValorComEvidencia(medidas, "area_global", escala.escala, coerentes);
      const comum = resolverValorComEvidencia(medidas, "area_comum", escala.escala, coerentes);

      const isLoteOuCasa =
        tipologia === "casas_lotes" ||
        base.tipo === "lote" ||
        base.tipo === "casa" ||
        base.tipo === "terreno" ||
        grupo.some((u) => u.tipo === "lote" || u.tipo === "casa" || u.tipo === "terreno");

      let area = privativa.valor;
      let areaMedida = privativa.medida;
      if (area != null) {
        regras.push("area_privativa");
      } else if (isLoteOuCasa && terrenoArea.valor != null) {
        area = terrenoArea.valor;
        areaMedida = terrenoArea.medida;
        regras.push("area_terreno");
      } else if (isLoteOuCasa) {
        const areasGenericas = medidas.filter(
          (m) =>
            (m.campo as string) === "area_generica" ||
            (m.campo === "indeterminado" && m.escala === "m2"),
        );
        if (areasGenericas.length === 1) {
          const valor = valorCanonico(areasGenericas[0], escala.escala);
          if (valor != null) {
            area = valor;
            areaMedida = areasGenericas[0];
            regras.push("area_generica");
          }
        }
      }

      const terreno = resolverValorComEvidencia(medidas, "fracao_terreno", escala.escala);
      const rateio = resolverValorComEvidencia(medidas, "coeficiente_rateio", escala.escala);
      const coisasComuns = resolverValorComEvidencia(
        medidas,
        "fracao_coisas_comuns",
        escala.escala,
      );
      registrarInvalidas([
        ...privativa.invalidas,
        ...terrenoArea.invalidas,
        ...global.invalidas,
        ...comum.invalidas,
        ...terreno.invalidas,
        ...rateio.invalidas,
        ...coisasComuns.invalidas,
      ]);
      let fracao = terreno.valor;
      let fracaoMedida = terreno.medida;
      if (fracao == null && !terreno.conflito) {
        fracao = rateio.valor ?? coisasComuns.valor;
        fracaoMedida = rateio.medida ?? coisasComuns.medida;
      }
      if (terreno.valor != null) regras.push("fracao_terreno");
      else if (rateio.valor != null) regras.push("coeficiente_rateio");
      else if (coisasComuns.valor != null) regras.push("fracao_coisas_comuns");

      // Candidatas a promoção quando o rótulo não estava visível no trecho.
      // SÓ promove indeterminado a área quando, no documento inteiro, NENHUMA unidade tiver area_privativa identificada.
      const indeterminadas = medidas.filter((m) => m.campo === "indeterminado");
      const indetArea = indeterminadas.filter((m) => m.escala === "m2");
      const indetFracao = indeterminadas.filter((m) => m.escala !== "m2");
      if (!documentoTemAreaPrivativa && area == null && indetArea.length === 1) {
        const valor = valorCanonico(indetArea[0], escala.escala);
        if (valor != null) {
          area = valor;
          areaMedida = indetArea[0];
          regras.push("promovido_de_indeterminado_area");
        }
      }

      if (area == null) {
        regras.push("area_privativa_ausente");
      }

      let promocaoFracao: { valor: number; medida: Medida } | null = null;
      if (fracao == null && !terreno.conflito && indetFracao.length === 1) {
        const valor = valorCanonico(indetFracao[0], escala.escala);
        if (fracaoNaFaixa(valor)) promocaoFracao = { valor, medida: indetFracao[0] };
      }

      if (privativa.conflito) conflitos.push(`${key}: área privativa divergente`);
      if (terrenoArea.conflito) conflitos.push(`${key}: área do terreno divergente`);
      if (terreno.conflito) conflitos.push(`${key}: fração do terreno divergente`);
      for (const regra of regras) regrasGlobais.add(regra);
      return {
        key,
        base,
        grupo,
        medidas,
        descartadas,
        regras,
        area,
        areaMedida,
        fracao,
        fracaoMedida,
        promocaoFracao,
        conflito: privativa.conflito || terreno.conflito,
      };
    });

  // A promoção de frações indeterminadas só vale se o somatório fechar.
  const promovidas = parciais.filter((p) => p.promocaoFracao);
  if (promovidas.length > 0) {
    const somaSem = parciais.reduce((total, p) => total + (p.fracao ?? 0), 0);
    const somaCom = somaSem + promovidas.reduce((t, p) => t + (p.promocaoFracao?.valor ?? 0), 0);
    const aceitar =
      Math.abs(somaCom - 1) <= 0.005 || Math.abs(somaCom - 1) < Math.abs(somaSem - 1);
    for (const parcial of promovidas) {
      if (aceitar) {
        parcial.fracao = parcial.promocaoFracao?.valor ?? null;
        parcial.fracaoMedida = parcial.promocaoFracao?.medida ?? null;
        parcial.regras.push("promovido_de_indeterminado_fracao");
        regrasGlobais.add("promovido_de_indeterminado_fracao");
      } else {
        parcial.regras.push("promocao_desfeita_soma_nao_fecha");
        regrasGlobais.add("promocao_desfeita_soma_nao_fecha");
      }
    }
  }

  const unidades = parciais.map((p) => {
    const conferiuAritmetica = p.regras.includes("area_total_conferida_com_comum");
    const completa = (p.area != null && p.fracao != null) || (p.area != null && conferiuAritmetica);
    const pendentePromocao = p.regras.includes("promocao_desfeita_soma_nao_fecha");
    const motivos: string[] = [...new Set([...(p.base.motivos ?? []), ...p.regras])];
    if (p.area == null && !motivos.includes("area_privativa_ausente")) {
      motivos.push("area_privativa_ausente");
    }
    let estado = p.base.estado;
    if (p.area == null) {
      estado = "nao_lido";
    } else if (!estado) {
      estado =
        p.conflito
          ? "lido_com_ressalva"
          : (completa && !pendentePromocao) || conferiuAritmetica
            ? "lido"
            : "lido_com_ressalva";
    }

    return {
      ...p.base,
      medidas: p.medidas,
      medidas_descartadas: p.descartadas,
      tipo: p.grupo.find((item) => item.tipo)?.tipo,
      vagas_garagem: p.grupo.find((item) => item.vagas_garagem != null)?.vagas_garagem,
      fracao_ideal: p.fracao,
      fracao_origem: p.fracaoMedida ? ("documento" as const) : ("ausente" as const),
      fracao_trecho: p.fracaoMedida?.trecho ?? null,
      area_m2: p.area,
      area_origem: p.areaMedida ? ("documento" as const) : ("ausente" as const),
      area_trecho: p.areaMedida?.trecho ?? null,
      confianca: p.conflito
        ? ("conflito" as const)
        : (completa && !pendentePromocao) || conferiuAritmetica
          ? ("alta" as const)
          : ("media" as const),
      estado,
      motivos,
      candidatos: Object.fromEntries(
        [...new Set(p.medidas.map((m) => m.campo))].map((campo) => [
          campo,
          p.medidas.filter((m) => m.campo === campo),
        ]),
      ),
      regras_aplicadas: [...new Set([...(p.base.regras_aplicadas ?? []), ...p.regras])],
    } satisfies UnidadeExtraida;
  });

  const medidasDescartadas: Record<string, number> = {};
  for (const unidade of unidades) {
    for (const item of unidade.medidas_descartadas ?? []) {
      medidasDescartadas[item.motivo] = (medidasDescartadas[item.motivo] ?? 0) + 1;
    }
  }

  return {
    unidades,
    conflitos,
    escala: escala.escala,
    somasHipoteses: escala.somas,
    regras: [...regrasGlobais],
    medidasDescartadas,
    orfas,
  };
}


/** Invariante 4 — o balanço tem que fechar aritmeticamente. */
export function montarBalanco(entrada: {
  linhasCandidatas: number;
  lidasPeloParser: number;
  lidasPelaIa: number;
  naoLidas: number;
  unidades: UnidadeExtraida[];
  semCorrespondencia: number;
}): NonNullable<DiagnosticoExtracao["balanco"]> {
  const soma = entrada.unidades.reduce((total, u) => total + (u.fracao_ideal ?? 0), 0);
  return {
    linhas_candidatas: entrada.linhasCandidatas,
    lidas_pelo_parser: entrada.lidasPeloParser,
    lidas_pela_ia: entrada.lidasPelaIa,
    nao_lidas: entrada.naoLidas,
    unidades_resolvidas: entrada.unidades.length,
    sem_correspondencia: entrada.semCorrespondencia,
    soma_fracoes: Number(soma.toFixed(6)),
    fecha:
      entrada.lidasPeloParser + entrada.lidasPelaIa + entrada.naoLidas === entrada.linhasCandidatas,
  };
}

export function validarCoberturaExtracao(
  unidades: UnidadeExtraida[],
  diagnostico: DiagnosticoExtracao,
  qtdEsperada: number | null,
) {
  const validacoes: NonNullable<DiagnosticoExtracao["validacoes"]> = [];
  const soma = unidades.reduce((acc, u) => acc + (u.fracao_ideal ?? 0), 0);
  validacoes.push({
    regra: "soma_fracoes",
    ok: soma === 0 ? true : Math.abs(soma - 1) <= 0.005,
    valor: Number(soma.toFixed(8)),
  });
  // A identidade "global = privativa + comum" NÃO vale em convenções que somam
  // a vaga de garagem à área total. A conferência correta é a (c) da leitura
  // descritiva: total = privativa + comum + vagas x constante derivada.
  const somaAreaPrivativa = unidades.reduce((total, unidade) => total + (unidade.area_m2 ?? 0), 0);
  validacoes.push({
    regra: "soma_area_privativa",
    ok: somaAreaPrivativa === 0 ? true : somaAreaPrivativa > 0,
    valor: Number(somaAreaPrivativa.toFixed(2)),
  });
  // A fração é proporcional à ÁREA EQUIVALENTE DE CONSTRUÇÃO, não à privativa.
  const areaEquivalente = (u: UnidadeExtraida) => {
    const m = u.medidas.find((item) => item.campo === "area_equivalente");
    return m ? numeroBrasileiro(m.valor_bruto) : null;
  };
  const usaEquivalente = unidades.some((u) => areaEquivalente(u) != null);
  const proporcionais = unidades.filter(
    (u) => u.fracao_ideal != null && (usaEquivalente ? areaEquivalente(u) != null : u.area_m2 != null),
  );
  const base = (u: UnidadeExtraida) => (usaEquivalente ? (areaEquivalente(u) ?? 1) : (u.area_m2 ?? 1));
  const ratios = proporcionais.map((u) => (u.fracao_ideal ?? 0) / base(u));
  const mediaRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  // Sem a área equivalente a proporcionalidade é só um indício: tolerância larga.
  const limite = usaEquivalente ? 0.0005 : 0.25;
  const foraProporcao = proporcionais.filter((u) => {
    const ratio = (u.fracao_ideal ?? 0) / base(u);
    return mediaRatio > 0 && Math.abs(ratio - mediaRatio) / mediaRatio > limite;
  });
  validacoes.push({
    regra: "proporcionalidade_area_fracao",
    ok: foraProporcao.length === 0,
    detalhe: usaEquivalente ? "base: área equivalente" : "base: área privativa (indício)",
    unidades: foraProporcao.map((u) => chaveUnidade(u.bloco ?? null, u.numero)),
  });

  const declarado = diagnostico.total_declarado_no_texto ?? qtdEsperada;
  validacoes.push({
    regra: "quantidade_unidades",
    ok: !declarado || declarado === unidades.length,
    valor: unidades.length,
    detalhe: declarado ? `declarado: ${declarado}` : "não declarado",
  });
  validacoes.push({
    regra: "lotes_processados",
    ok: !diagnostico.lotes_com_erro,
    valor: diagnostico.lotes_com_erro ?? 0,
  });
  const balanco = diagnostico.balanco;
  if (balanco) {
    validacoes.push({
      regra: "linhas_nao_lidas",
      ok: balanco.nao_lidas === 0,
      valor: balanco.nao_lidas,
      detalhe: (diagnostico.linhas_nao_lidas ?? [])
        .slice(0, 5)
        .map((l) => `p.${l.pagina ?? "?"}: ${l.texto}`)
        .join(" | "),
    });
    validacoes.push({
      regra: "linhas_sem_correspondencia",
      ok: balanco.sem_correspondencia === 0,
      valor: balanco.sem_correspondencia,
    });
    validacoes.push({
      regra: "balanco_fecha",
      ok: balanco.fecha,
      valor: balanco.linhas_candidatas,
      detalhe: `parser ${balanco.lidas_pelo_parser} + ia ${balanco.lidas_pela_ia} + não lidas ${balanco.nao_lidas}`,
    });
  }
  diagnostico.validacoes = validacoes;
  return validacoes;
}

async function persistirFalha(
  supabase: SupabaseClient,
  doc: { id: string; condominio_id: string },
  mensagem: string,
  diagnostico: DiagnosticoExtracao,
) {
  await supabase
    .from("sugestoes_unidades")
    .delete()
    .eq("documento_id", doc.id)
    .in("status", ["pendente", "falhou"]);
  await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades: [], diagnostico: { ...diagnostico, observacao: mensagem } },
    status: "falhou",
  });
  await supabase
    .from("documentos")
    .update({
      processamento_meta: {
        etapa: "interpretacao_unidades",
        extracao_status: "falhou",
        mensagem,
        diagnostico,
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", doc.id);
}

async function carregarTodosChunks(supabase: SupabaseClient, documentoId: string) {
  const todos: ChunkRow[] = [];
  const pagina = 500;
  for (let inicio = 0; ; inicio += pagina) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("id, conteudo, metadata")
      .eq("documento_id", documentoId)
      .order("metadata->ordem_global", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(inicio, inicio + pagina - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as ChunkRow[];
    todos.push(...lote);
    if (lote.length < pagina) return todos;
  }
}

export async function hashLote(texto: string) {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function lerCacheExtracao(supabase: SupabaseClient, hash: string) {
  const { data } = await supabase
    .from("extracao_cache")
    .select("resposta_json")
    .eq("hash_lote", hash)
    .eq("versao_prompt", VERSAO_PROMPT)
    .maybeSingle();
  return (data?.resposta_json as unknown) ?? null;
}

async function gravarCacheExtracao(supabase: SupabaseClient, hash: string, resposta: unknown) {
  await supabase
    .from("extracao_cache")
    .upsert(
      { hash_lote: hash, versao_prompt: VERSAO_PROMPT, resposta_json: resposta as never },
      { onConflict: "hash_lote,versao_prompt" },
    );
}
const decimalBr = (valor: number, casas = 2) => valor.toFixed(casas).replace(".", ",");

/** Converte a leitura determinística da seção descritiva no formato de sugestão. */
export function unidadesDaLeituraDescritiva(
  leitura: LeituraDescritiva,
  conhecidas: Array<{ bloco: string | null; numero: string }>,
): UnidadeExtraida[] {
  const pendentes = new Set(leitura.pendentes);
  return leitura.unidades.map((u) => {
    const identidade = resolverIdentidade(
      { bloco: u.bloco, numero: u.numero, bloco_contexto: u.bloco },
      conhecidas as Conhecida[],
    );
    const bloco = identidade.status === "resolvida" ? identidade.bloco : u.bloco;
    const numero = identidade.status === "resolvida" ? identidade.numero : u.numero;
    const trecho = u.corpo.slice(0, 600);
    const medidas: UnidadeExtraida["medidas"] = [];
    const push = (
      campo: z.infer<typeof CampoMedidaSchema>,
      valor: number | null,
      escala: z.infer<typeof EscalaMedidaSchema>,
      casas = 2,
    ) => {
      if (valor == null) return;
      medidas.push({
        campo,
        valor_bruto: decimalBr(valor, casas),
        escala,
        trecho,
        linha_id: null,
        pagina: null,
        bloco: null,
        fonte: `seção descritiva, bloco ${u.bloco_descritivo + 1}`,
        bloco_contexto: u.bloco,
      });
    };
    push("area_privativa", u.area_privativa, "m2");
    push("area_terreno", u.area_terreno, "m2");
    push("area_comum", u.area_comum, "m2");
    push("area_global", u.area_total, "m2");
    push("area_equivalente", u.area_equivalente, "m2");
    push("fracao_terreno", u.fracao_ideal, "decimal", 8);
    const areaFinal = u.area_privativa ?? u.area_terreno ?? null;
    const completa = areaFinal != null && u.fracao_ideal != null;
    return {
      bloco,
      numero,
      tipo: "apartamento" as const,
      vagas_garagem: u.vagas ?? undefined,
      medidas,
      medidas_descartadas: [],
      fonte: "secao_descritiva",
      fracao_ideal: u.fracao_ideal,
      fracao_origem: u.fracao_ideal != null ? ("documento" as const) : ("ausente" as const),
      fracao_trecho: trecho,
      area_m2: areaFinal,
      area_origem: areaFinal != null ? ("documento" as const) : ("ausente" as const),
      area_trecho: trecho,
      confianca:
        completa && !pendentes.has(u.identificador) ? ("alta" as const) : ("media" as const),
      regras_aplicadas: [
        "secao_descritiva",
        u.area_privativa != null ? "area_real_privativa" : "area_terreno",
        "fracao_ideal_declarada",
        identidade.regra,
      ],
    } satisfies UnidadeExtraida;
  });
}

export type ResultadoRodadaExtracao = {
  ok: boolean;
  concluido: boolean;
  etapa: string;
  total: number;
  concluidos: number;
  estado: "processando" | "pronto" | "falhou" | "pronto_com_pendencias";
  aviso?: string | null;
  erro?: string | null;
  unidades?: UnidadeExtraida[];
  mensagem?: string | null;
  lotes_pendentes?: Array<{ lote: number; motivo: string; texto?: string }>;
};

export async function processarExtracaoRodada(
  supabase: SupabaseClient,
  documentoId: string,
  apiKey: string,
  opts: {
    reiniciar?: boolean;
    paginaInicio?: number;
    paginaFim?: number;
    orcamentoMs?: number;
    chamarIa?: typeof chamarIaJson;
    somenteLotesPendentes?: boolean;
  } = {},
): Promise<ResultadoRodadaExtracao> {
  const chamarIaEfetivo = opts.chamarIa ?? chamarIaJson;
  const { data: doc, error } = await supabase
    .from("documentos")
    .select("id, condominio_id, nome_arquivo, status_processamento")
    .eq("id", documentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.status_processamento !== "pronto")
    throw new Error("Documento ainda não foi processado por completo.");

  const { data: cond } = await supabase
    .from("condominios")
    .select("categoria, qtd_unidades, owner_id")
    .eq("id", doc.condominio_id)
    .maybeSingle();
  const { data: existentes } = await supabase
    .from("unidades")
    .select("bloco, numero")
    .eq("condominio_id", doc.condominio_id);
  const conhecidas = (existentes ?? []).map((u) => ({
    bloco: u.bloco as string | null,
    numero: String(u.numero),
  }));

  const { data: jobDb } = await supabase
    .from("extracao_jobs")
    .select("*")
    .eq("documento_id", doc.id)
    .maybeSingle();

  let job = jobDb;

  // Reprocessamento exclusivo dos lotes pendentes.
  // IMPORTANTE: só pode ocorrer UMA vez, no disparo inicial. A tela repete a
  // chamada a cada rodada; se reconstruíssemos a lista de lotes em toda rodada,
  // os trechos ainda não lidos seriam descartados e a extração terminaria
  // "concluída" com unidades faltando.
  if (opts.somenteLotesPendentes && job?.metadata && job.estado !== "processando") {

    const metaExistente = job.metadata as Record<string, unknown>;
    const pendentes = (metaExistente.lotesPendentes as Array<{ lote: number; motivo: string; texto?: string }>) ?? [];
    if (pendentes.length > 0) {
      // A etapa de leitura consome os lotes no formato { id, texto }.
      const novosLotes: Array<{ id: string; texto: string }> = pendentes.map((p, idx) => ({
        id: `pendente-${idx + 1}`,
        texto: p.texto ?? "",
      }));
      const metaAtualizada = {
        ...metaExistente,
        lotes: novosLotes,
        cursorLote: 0,
        lotesComErro: 0,
        lotesPendentes: [],
      };
      await supabase
        .from("extracao_jobs")
        .update({
          etapa: "leitura_ia",
          total: novosLotes.length,
          concluidos: 0,
          estado: "processando",
          erro: null,
          metadata: metaAtualizada,
          atualizado_em: new Date().toISOString(),
        })
        .eq("documento_id", doc.id);

      job = {
        ...job,
        etapa: "leitura_ia",
        total: novosLotes.length,
        concluidos: 0,
        estado: "processando",
        erro: null,
        metadata: metaAtualizada,
      };
    }
  } else if (opts.reiniciar || !job || job.estado === "pronto" || job.estado === "falhou" || job.estado === "pronto_com_pendencias") {
    const { data: novoJob, error: novoErr } = await supabase
      .from("extracao_jobs")
      .upsert(
        {
          documento_id: doc.id,
          etapa: "carregamento_e_roteamento",
          total: 4,
          concluidos: 0,
          estado: "processando",
          erro: null,
          metadata: {},
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "documento_id" },
      )
      .select("*")
      .single();
    if (novoErr) throw new Error(novoErr.message);
    job = novoJob;
  }

  const meta = ((job.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  try {
    // 1) ETAPA: Carregamento e Roteamento de páginas
    if (job.etapa === "carregamento_e_roteamento") {
      const carregamento = await carregarTextoIntegral(supabase, doc.id);
      let { paginas, textoIntegral } = carregamento;
      const { fonte: fonteUsada, totalPaginas, totalCaracteres } = carregamento;

      // Filtro manual de páginas, sem chamada de IA de roteamento
      if (opts.paginaInicio || opts.paginaFim) {
        const inicioFiltro = opts.paginaInicio || 1;
        const fimFiltro = opts.paginaFim || 99999;
        paginas = paginas.filter((p) => p.numero <= fimFiltro && p.numero >= inicioFiltro);
        textoIntegral = paginas.map((p) => p.texto).join("\n");
      }

      await supabase
        .from("extracao_jobs")
        .update({
          etapa: "segmentacao_e_descritiva",
          total: 4,
          concluidos: 1,
          estado: "processando",
          metadata: {
            fonteUsada,
            totalPaginas,
            totalCaracteres,
          },
          atualizado_em: new Date().toISOString(),
        })
        .eq("documento_id", doc.id);

      return {
        ok: true,
        concluido: false,
        etapa: "carregamento_e_roteamento",
        total: 4,
        concluidos: 1,
        estado: "processando",
      };
    }

    // 2) ETAPA: Segmentação determinística e Leitura Descritiva
    if (job.etapa === "segmentacao_e_descritiva") {
      let paginas = (meta.paginas as Array<{ numero: number; texto: string }>) ?? [];
      let textoIntegral = (meta.textoIntegral as string) ?? "";
      let fonteUsada = (meta.fonteUsada as string) ?? "storage";
      let totalPaginas = (meta.totalPaginas as number) ?? paginas.length;
      let totalCaracteres = (meta.totalCaracteres as number) ?? textoIntegral.length;

      if (paginas.length === 0) {
        const carregamento = await carregarTextoIntegral(supabase, doc.id);
        paginas = carregamento.paginas;
        textoIntegral = carregamento.textoIntegral;
        fonteUsada = carregamento.fonte;
        totalPaginas = carregamento.totalPaginas;
        totalCaracteres = carregamento.totalCaracteres;
        if (opts.paginaInicio || opts.paginaFim) {
          const inicioFiltro = opts.paginaInicio || 1;
          const fimFiltro = opts.paginaFim || 99999;
          paginas = paginas.filter((p) => p.numero <= fimFiltro && p.numero >= inicioFiltro);
          textoIntegral = paginas.map((p) => p.texto).join("\n");
        }
      }

      const chunks: ChunkRow[] = paginas.map((p, idx) => ({
        id: `pag-${p.numero}`,
        conteudo: p.texto,
        metadata: {
          ordem_global: idx,
          pagina_inicio: p.numero,
          pagina_fim: p.numero,
          bloco: p.numero,
          trecho: idx,
        },
      }));

      const registros = segmentarRegistros(paginas, doc.id);
      const registrosGrupo = registros.filter((r) => r.padrao_ancora.startsWith("grupo:")).length;
      const registrosIndividual = registros.length - registrosGrupo;

      const { detectarTipologia } = await import("./extracao/tipologia");
      const tipologiaDetectada = detectarTipologia(paginas);
      const categoriaCadastrada = cond?.categoria ? normalizeCategoria(cond.categoria as string) : null;
      const tipologiaNormalizada = normalizeCategoria(tipologiaDetectada);
      const divergiu = Boolean(categoriaCadastrada && categoriaCadastrada !== tipologiaNormalizada);
      const avisoTipologiaDivergente = divergiu
        ? {
            cadastrada: (cond?.categoria as string) || "predio",
            detectada: tipologiaDetectada,
            mensagem: `A convenção aparenta ser de "${getCategoriaMeta(tipologiaDetectada).label}", mas o condomínio está cadastrado como "${getCategoriaMeta(cond?.categoria as string).label}".`,
          }
        : null;

      const descritiva = interpretarConvencaoDescritiva(textoIntegral, registros.length);
      if (descritiva.ok) {
        const unidades = unidadesDaLeituraDescritiva(descritiva, conhecidas);
        const diagnostico: DiagnosticoExtracao = {
          leitura: "secao_descritiva",
          registros_bloco_individual: registrosIndividual,
          registros_bloco_grupo: registrosGrupo,
          total_trechos: chunks.length,
          trechos_selecionados: 0,
          prefiltro: "seção descritiva lida sem IA",
          chamadas_ia: 0,
          chamadas_em_cache: 0,
          tokens_input: 0,
          tokens_output: 0,
          total_lotes: 0,
          lotes_processados: 0,
          lotes_com_erro: 0,
          erros: [],
          conflitos: [],
          escala_fracao: "decimal",
          regra_area: "area_real_privativa",
          total_declarado_no_texto: descritiva.rol?.total_declarado ?? null,
          quadro_fracoes_encontrado: true,
          rol_artigo_2: descritiva.rol
            ? {
                total_declarado: descritiva.rol.total_declarado,
                identificadores: descritiva.rol.identificadores,
              }
            : null,
          conferencias: descritiva.conferencias,
          balanco_descritivo: descritiva.balanco,
          balanco: {
            linhas_candidatas: descritiva.balanco.identificadores_no_rol || descritiva.unidades.length,
            lidas_pelo_parser: descritiva.unidades.length,
            lidas_pela_ia: 0,
            nao_lidas: descritiva.faltando.length,
            unidades_resolvidas: unidades.length,
            sem_correspondencia: descritiva.sobrando.length,
            soma_fracoes: descritiva.balanco.soma_fracoes,
            fecha: descritiva.balanco.fecha,
          },
          linhas_nao_lidas: descritiva.faltando.map((id) => ({
            linha_id: id,
            texto: `Identificador ${id} consta do rol do Artigo 2 e não foi lido na seção descritiva.`,
            pagina: null,
          })),
          orfas: descritiva.sobrando.map((id) => ({
            numero: id,
            bloco: null,
            texto: `Unidade ${id} descrita no documento e ausente do rol do Artigo 2.`,
            pagina: null,
            linha_id: null,
          })),
          unidades_encontradas: unidades.length,
          unidades_com_fracao: unidades.filter((u) => u.fracao_ideal != null).length,
          unidades_com_area: unidades.filter((u) => u.area_m2 != null).length,
          unidades_confianca_alta: unidades.filter((u) => u.confianca === "alta").length,
          unidades_pendentes_revisao: unidades.filter((u) => u.confianca !== "alta").length,
          duracao_ms: 0,
          fonte: fonteUsada,
          total_paginas: totalPaginas,
          total_caracteres: totalCaracteres,
          tipologia_detectada: tipologiaDetectada,
          tipologia_divergente: avisoTipologiaDivergente,
          tentativa_descritiva: { ...descritiva.tentativa, caminho_usado: "secao_descritiva" },
          observacao:
            `Leitura determinística da seção descritiva: ${descritiva.balanco.blocos_descritivos} blocos descritivos, ${unidades.length} unidades após expansão` +
            (descritiva.soma_ok
              ? "."
              : `; a soma das frações deu ${descritiva.balanco.soma_fracoes} e a sugestão foi marcada para revisão.`) +
            (descritiva.regras_aplicadas.length
              ? ` Regras de escala: ${descritiva.regras_aplicadas.join("; ")}.`
              : ""),
        };

        const unidadesFinais = await persistirExtracao({
          supabase,
          doc,
          unidades,
          diagnostico,
          conhecidas,
          escala: "decimal",
          qtdEsperada: (cond?.qtd_unidades as number | null) ?? null,
          force: false,
          pendenciasExtras:
            descritiva.faltando.length +
            descritiva.sobrando.length +
            descritiva.duplicadas.length +
            (descritiva.soma_ok ? 0 : 1),
          registros,
        });

        await supabase
          .from("extracao_jobs")
          .update({
            etapa: "concluido",
            total: 4,
            concluidos: 4,
            estado: "pronto",
            erro: null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("documento_id", doc.id);

        return {
          ok: true,
          concluido: true,
          etapa: "concluido",
          total: 4,
          concluidos: 4,
          estado: "pronto",
          unidades: unidadesFinais,
        };
      }

      // Extração determinística (Registros Posicionais e Quadros/Tabelas)
      const { lerRegistro } = await import("./extracao/rotulos");
      const candidatasDosRegistros: UnidadeExtraida[] = [];
      const registrosSemMedidas: RegistroUnidade[] = [];

      if (registros.length > 0) {
        for (const reg of registros) {
          if (reg.motivo_descarte === "identidade_repetida_no_documento") continue;
          const medidasLidas = lerRegistro(reg.texto);
          const medidas: z.infer<typeof MedidaExtraidaSchema>[] = [];
          let vagas: number | undefined = undefined;

          for (const med of medidasLidas) {
            if (med.campo === "vagas") {
              vagas = Math.round(med.valor_numerico ?? 0);
              continue;
            }
            let campo: z.infer<typeof CampoMedidaSchema> = "indeterminado";
            if (med.campo === "area_privativa") campo = "area_privativa";
            else if (med.campo === "area_terreno") campo = "area_terreno";
            else if (med.campo === "area_comum") campo = "area_comum";
            else if (med.campo === "area_total") campo = "area_global";
            else if (med.campo === "area_equivalente") campo = "area_equivalente";
            else if (med.campo === "area_garagem") campo = "area_garagem";
            else if (med.campo === "area_construcao") campo = "area_construcao";
            else if (med.campo === "cota_terreno") campo = "cota_terreno";
            else if (med.campo === "fracao_ideal") campo = "fracao_terreno";
            else if (med.campo === "area_generica") {
              campo = (tipologiaDetectada === "casas_lotes" || reg.ancora.toLowerCase().includes("lote"))
                ? "area_terreno"
                : "indeterminado";
            }

            medidas.push({
              campo,
              valor_bruto: med.valor_bruto,
              escala: med.escala as any,
              trecho: med.trecho,
              linha_id: reg.registro_id,
              pagina: reg.pagina,
              bloco: null,
              fonte: `registro ${reg.registro_id}`,
              bloco_contexto: reg.escopo,
            });
          }

          const temArea = medidas.some(
            (m) =>
              m.campo === "area_privativa" ||
              m.campo === "area_terreno" ||
              m.campo === "area_global" ||
              m.campo === "indeterminado",
          );
          const temFracao = medidas.some(
            (m) =>
              m.campo === "fracao_terreno" ||
              m.campo === "coeficiente_rateio" ||
              m.campo === "fracao_coisas_comuns",
          );

          if (!temArea && !temFracao) {
            registrosSemMedidas.push(reg);
          }

          const tipo = (tipologiaDetectada === "casas_lotes" || reg.ancora.toLowerCase().includes("lote"))
            ? "lote"
            : (reg.ancora.toLowerCase().includes("casa") ? "casa" : "apartamento");

          candidatasDosRegistros.push({
            bloco: reg.escopo,
            numero: reg.sufixo ? `${reg.numero}${reg.sufixo}` : reg.numero,
            tipo,
            vagas_garagem: vagas,
            linha_id: reg.registro_id,
            medidas,
            medidas_descartadas: [],
            fonte: "registros_posicionais",
            regras_aplicadas: ["registros_posicionais", reg.padrao_ancora],
          });
        }
      }

      // Censo e leitor determinístico de quadros/tabelas Markdown
      const censo = construirCenso(doc.id, chunks);
      const { extrairUnidadesDeQuadros } = await import("./quadro-parser");
      const quadro = extrairUnidadesDeQuadros(censo);

      // Candidatas determinísticas totais
      const candidatasDeterministas = [...candidatasDosRegistros, ...quadro.unidades];

      if (candidatasDeterministas.length > 0) {
        const censoMap = {
          porId: new Map([
            ...registros.map((r) => [r.registro_id, { pagina: r.pagina, texto: r.texto }] as const),
            ...censo.candidatas.map((c) => [c.linha_id, { pagina: c.pagina, texto: c.texto }] as const),
          ]),
        };
        const consolidadoDet = consolidar(candidatasDeterministas, conhecidas, censoMap, registros, tipologiaDetectada);

        const temUnidades = consolidadoDet.unidades.length > 0;
        const todasComAreaEFracao = temUnidades && consolidadoDet.unidades.every((u) => u.area_m2 != null && u.fracao_ideal != null);
        const qtdEsperadaOk = cond?.qtd_unidades == null || consolidadoDet.unidades.length >= cond.qtd_unidades;
        const rolDeclaradoOk = descritiva.rol?.total_declarado == null || consolidadoDet.unidades.length >= descritiva.rol.total_declarado;
        const rolIdentificadoresOk = !descritiva.rol?.identificadores?.length || descritiva.rol.identificadores.every((id) =>
          consolidadoDet.unidades.some((u) => u.numero === id || chaveUnidade(u.bloco ?? null, u.numero).includes(id))
        );

        // Se o parser determinístico (quadro ou registros) já extraiu todas as unidades com área e fração:
        // NÃO chamar IA, concluir imediatamente.
        if (todasComAreaEFracao && qtdEsperadaOk && rolDeclaradoOk && rolIdentificadoresOk) {
          const somaFracoes = consolidadoDet.unidades.reduce((acc, u) => acc + (u.fracao_ideal ?? 0), 0);
          const tipoLeitura = quadro.unidades.length > 0
            ? (candidatasDosRegistros.length > 0 ? "hibrida_deterministica" : "quadro_parser")
            : "registros_posicionais";

          const diagnostico: DiagnosticoExtracao = {
            leitura: tipoLeitura as any,
            registros_bloco_individual: registrosIndividual,
            registros_bloco_grupo: registrosGrupo,
            total_trechos: chunks.length,
            trechos_selecionados: 0,
            prefiltro: "leitura determinística completa sem IA",
            chamadas_ia: 0,
            chamadas_em_cache: 0,
            tokens_input: 0,
            tokens_output: 0,
            total_lotes: 0,
            lotes_processados: 0,
            lotes_com_erro: 0,
            erros: [],
            conflitos: consolidadoDet.conflitos,
            escala_fracao: consolidadoDet.escala,
            regra_area: tipologiaDetectada === "casas_lotes" ? "area_terreno" : "area_real_privativa",
            total_declarado_no_texto: descritiva.rol?.total_declarado ?? consolidadoDet.unidades.length,
            quadro_fracoes_encontrado: true,
            rol_artigo_2: descritiva.rol
              ? {
                  total_declarado: descritiva.rol.total_declarado,
                  identificadores: descritiva.rol.identificadores,
                }
              : null,
            conferencias: descritiva.conferencias,
            balanco_descritivo: descritiva.balanco,
            balanco: {
              linhas_candidatas: registros.length > 0 ? registros.length : quadro.linhasLidas.size,
              lidas_pelo_parser: consolidadoDet.unidades.length,
              lidas_pela_ia: 0,
              nao_lidas: 0,
              unidades_resolvidas: consolidadoDet.unidades.length,
              sem_correspondencia: consolidadoDet.orfas.length,
              soma_fracoes: Number(somaFracoes.toFixed(6)),
              fecha: Math.abs(somaFracoes - 1) <= 0.005,
            },
            unidades_encontradas: consolidadoDet.unidades.length,
            unidades_com_fracao: consolidadoDet.unidades.filter((u) => u.fracao_ideal != null).length,
            unidades_com_area: consolidadoDet.unidades.filter((u) => u.area_m2 != null).length,
            unidades_confianca_alta: consolidadoDet.unidades.filter((u) => u.confianca === "alta").length,
            unidades_pendentes_revisao: consolidadoDet.unidades.filter((u) => u.confianca !== "alta").length,
            duracao_ms: 0,
            fonte: fonteUsada,
            total_paginas: totalPaginas,
            total_caracteres: totalCaracteres,
            tipologia_detectada: tipologiaDetectada,
            tipologia_divergente: avisoTipologiaDivergente,
            tentativa_descritiva: {
              ...descritiva.tentativa,
              caminho_usado:
                tipoLeitura === "registros_posicionais" ? tipoLeitura : "censo_de_linhas",
              registros_segmentados: registros.length,
              caminho_escolhido: tipoLeitura,
              motivo_da_escolha: `todas as ${consolidadoDet.unidades.length} unidades resolvidas deterministicamente com área e fração`,
            },
            observacao: `Leitura determinística concluída: ${consolidadoDet.unidades.length} unidades resolvidas sem IA.`,
          };

          const unidadesFinais = await persistirExtracao({
            supabase,
            doc,
            unidades: consolidadoDet.unidades,
            diagnostico,
            conhecidas,
            escala: consolidadoDet.escala,
            qtdEsperada: (cond?.qtd_unidades as number | null) ?? null,
            force: false,
            pendenciasExtras: consolidadoDet.conflitos.length + (Math.abs(somaFracoes - 1) <= 0.005 ? 0 : 1),
            registros,
          });

          await supabase
            .from("extracao_jobs")
            .update({
              etapa: "concluido",
              total: 4,
              concluidos: 4,
              estado: "pronto",
              erro: null,
              atualizado_em: new Date().toISOString(),
            })
            .eq("documento_id", doc.id);

          return {
            ok: true,
            concluido: true,
            etapa: "concluido",
            total: 4,
            concluidos: 4,
            estado: "pronto",
            unidades: unidadesFinais,
          };
        }
      }

      // Se nem todas as unidades foram resolvidas deterministicamente,
      // filtra apenas os trechos que contêm unidades pendentes.
      const chavesResolvidas = new Set(
        candidatasDeterministas
          .filter(
            (u) =>
              (u.medidas ?? []).some((m) => m.campo === "area_privativa" || m.campo === "area_terreno") &&
              (u.medidas ?? []).some((m) => m.campo === "fracao_terreno" || m.campo === "coeficiente_rateio"),
          )
          .map((u) => chaveUnidade(u.bloco ?? null, u.numero)),
      );

      const naoLidas = censo.candidatas.filter((l) => {
        if (quadro.linhasLidas.has(l.linha_id)) return false;
        const id = identificadorDaLinha(l.texto);
        if (id && chavesResolvidas.has(chaveUnidade(id.sufixoBloco, id.numero))) return false;
        return true;
      });

      const chunksComCandidatas = new Set(naoLidas.map((l) => l.chunk_id));
      const chunksRelevantes = chunks.filter((c) => chunksComCandidatas.has(c.id));
      let lotesMagros: Array<{ id: string; escopo?: string | null; numero?: string; texto: string }>;
      if (registros.length > 0) {
        const registrosPendentes = registros.filter((reg) => {
          const numFinal = reg.sufixo ? `${reg.numero}${reg.sufixo}` : reg.numero;
          return !chavesResolvidas.has(chaveUnidade(reg.escopo, numFinal));
        });
        lotesMagros = registrosPendentes.map((reg) => ({
          id: reg.registro_id,
          escopo: reg.escopo ?? null,
          numero: reg.sufixo ? `${reg.numero}${reg.sufixo}` : reg.numero,
          texto: reg.texto,
        }));
      } else {
        const lotesCompletos = montarLotes(chunksRelevantes as ChunkRow[]);
        lotesMagros = lotesCompletos.map((l, i) => ({ id: `lote-${i}`, texto: l.texto }));
      }

      if (censo.candidatas.length === 0) {
        const mensagem = "Nenhum trecho sobre unidades, áreas ou frações foi localizado no texto indexado.";
        const diagnosticoVazio: DiagnosticoExtracao = {
          leitura: "quadro_ia",
          tentativa_descritiva: { ...descritiva.tentativa, caminho_usado: "censo_de_linhas" },
          total_trechos: chunks.length,
          fonte: fonteUsada,
          total_paginas: totalPaginas,
          total_caracteres: totalCaracteres,
          tipologia_detectada: tipologiaDetectada,
          tipologia_divergente: avisoTipologiaDivergente,
        };
        await persistirFalha(supabase, doc, mensagem, diagnosticoVazio);
        await supabase
          .from("extracao_jobs")
          .update({
            etapa: "falhou",
            estado: "falhou",
            erro: mensagem,
            atualizado_em: new Date().toISOString(),
          })
          .eq("documento_id", doc.id);
        throw new ExtracaoIncompletaError(mensagem, diagnosticoVazio);
      }

      await supabase
        .from("extracao_jobs")
        .update({
          etapa: lotesMagros.length > 0 ? "leitura_ia" : "gravacao",
          total: lotesMagros.length || 4,
          concluidos: 0,
          estado: "processando",
          metadata: {
            ...meta,
            lotes: lotesMagros,
            candidatas: candidatasDeterministas,
            linhasLidasQuadroIds: Array.from(quadro.linhasLidas),
            naoLidasLinhasIds: naoLidas.map((l) => l.linha_id),
            chunksCount: chunks.length,
            tipologiaDetectada,
            avisoTipologiaDivergente,
            descritivaTentativa: descritiva.tentativa,
            descritivaRol: descritiva.rol,
            cursorLote: 0,
            tokensInput: 0,
            tokensOutput: 0,
            chamadasIa: 0,
            chamadasCache: 0,
          },
          atualizado_em: new Date().toISOString(),
        })
        .eq("documento_id", doc.id);

      return {
        ok: true,
        concluido: false,
        etapa: "segmentacao_e_descritiva",
        total: lotesMagros.length || 4,
        concluidos: 0,
        estado: "processando",
      };
    }

    // 3) ETAPA: Leitura dos lotes com IA (Gemini)
    if (job.etapa === "leitura_ia") {
      let lotes = ((meta.lotes as Array<{ id?: string; texto: string }>) ?? []);
      let cursor = (meta.cursorLote as number) ?? 0;
      const candidatas = (meta.candidatas as UnidadeExtraida[]) ?? [];
      let tokensInput = (meta.tokensInput as number) ?? 0;
      let tokensOutput = (meta.tokensOutput as number) ?? 0;
      let chamadasIa = (meta.chamadasIa as number) ?? 0;
      let chamadasCache = (meta.chamadasCache as number) ?? 0;
      let lotesComErro = (meta.lotesComErro as number) ?? 0;
      const lotesPendentes = (meta.lotesPendentes as Array<{ lote: number; motivo: string; texto?: string }>) ?? [];
      const tipologiaDetectada = (meta.tipologiaDetectada as string) ?? "predio";

      const categoria = getCategoriaMeta(tipologiaDetectada);
      const system = PROMPT_SISTEMA_BASE.replace(
        "de uma convenção condominial brasileira. ",
        `de uma convenção condominial brasileira. ${categoria.vocabIA} `,
      );

      const startMs = Date.now();
      const budgetMs = opts.orcamentoMs ?? DEFAULT_ORCAMENTO_MS;
      let mensagemStatus: string | null = null;
      let chamadasNestaRodada = 0;

      while (cursor < lotes.length) {
        const tempoDecorrido = Date.now() - startMs;
        const restante = budgetMs - tempoDecorrido;

        // Condição de parada por tempo: só encerra se ao menos UMA chamada já foi realizada nesta rodada.
        // Uma rodada NUNCA termina com 0 chamadas tentadas.
        if (chamadasNestaRodada > 0 && restante <= 10_000) {
          break;
        }

        // A PRIMEIRA chamada da rodada SEMPRE recebe o TIMEOUT_CHAMADA cheio (30s).
        // As subsequentes recebem Math.min(TIMEOUT_CHAMADA, restante).
        const timeoutMs = chamadasNestaRodada === 0
          ? TIMEOUT_CHAMADA
          : Math.min(TIMEOUT_CHAMADA, restante);

        // Bloco de até CONCORRENCIA (4) lotes paralelos
        const blocoIndices: number[] = [];
        for (let i = 0; i < CONCORRENCIA && cursor + i < lotes.length; i++) {
          blocoIndices.push(cursor + i);
        }

        mensagemStatus = `Lendo trecho(s) ${cursor + 1} a ${cursor + blocoIndices.length} de ${lotes.length}…`;

        const resultados = await Promise.all(
          blocoIndices.map(async (idx) => {
            const lote = lotes[idx];
            try {
              const hash = await hashLote(lote.texto);
              const cacheado = await lerCacheExtracao(supabase, hash);
              if (cacheado) {
                return { tipo: "cache" as const, idx, lote, data: cacheado };
              }
              const userPrompt = (lote as any).numero
                ? `Unidade: ${(lote as any).escopo ? `${(lote as any).escopo} ` : ""}${(lote as any).numero}\nTrecho:\n${lote.texto}`
                : `Arquivo: ${doc.nome_arquivo}\nLote ${idx + 1}/${lotes.length}:\n${lote.texto}`;
              const chamada = await chamarIaEfetivo(
                apiKey,
                system,
                userPrompt,
                { timeoutMs },
              );
              await gravarCacheExtracao(supabase, hash, chamada.data);
              return { tipo: "ia" as const, idx, lote, data: chamada.data, usage: chamada.usage };
            } catch (err: unknown) {
              return { tipo: "erro" as const, idx, lote, err };
            }
          }),
        );

        chamadasNestaRodada += blocoIndices.length;
        let teveTimeout = false;
        const novosLotesDivididos: Array<{ id?: string; texto: string }> = [];
        let primeiroTimeoutOffset = -1;

        for (let b = 0; b < resultados.length; b++) {
          const res = resultados[b];
          if (res.tipo === "cache") {
            chamadasCache++;
            processarRespostaIA(res.data, res.lote as any, tipologiaDetectada, candidatas);
          } else if (res.tipo === "ia") {
            chamadasIa++;
            tokensInput += res.usage.prompt_tokens;
            tokensOutput += res.usage.completion_tokens;
            processarRespostaIA(res.data, res.lote as any, tipologiaDetectada, candidatas);
          } else if (res.tipo === "erro") {
            const isTimeoutOrLength =
              res.err instanceof ErroTimeoutIA ||
              res.err instanceof ErroTruncadoIA ||
              (res.err instanceof Error && /timeout|tempo limite|truncad/i.test(res.err.message));

            if (isTimeoutOrLength) {
              const partes = dividirTextoAoMeio(res.lote.texto, 2_000);
              if (partes) {
                const [p1, p2] = partes;
                novosLotesDivididos.push(
                  { id: `${res.lote.id || `lote-${res.idx}`}-a`, texto: p1 },
                  { id: `${res.lote.id || `lote-${res.idx}`}-b`, texto: p2 },
                );
                teveTimeout = true;
                if (primeiroTimeoutOffset === -1) {
                  primeiroTimeoutOffset = b;
                }
                continue;
              }
            }

            // Lote indivisível ou outro erro
            const motivo = res.err instanceof Error ? res.err.message : String(res.err);
            lotesComErro++;
            lotesPendentes.push({
              lote: res.idx + 1,
              motivo,
              texto: res.lote.texto,
            });
          }
        }

        if (teveTimeout) {
          // Se houve timeout, os lotes a partir do timeout são substituídos pelas metades
          // e a rodada se encerra imediatamente para que iniciem frescas na próxima rodada com 30s.
          const indiceNoLotes = cursor + primeiroTimeoutOffset;
          lotes.splice(indiceNoLotes, 1, ...novosLotesDivididos);
          cursor = indiceNoLotes;
          mensagemStatus = `O trecho ${cursor + 1} excedeu o tempo e foi dividido. Retomando na próxima rodada com 30s.`;
          break;
        } else {
          cursor += blocoIndices.length;
        }
      }

      const concluidoLotes = cursor >= lotes.length;
      const proximaEtapa = concluidoLotes ? "gravacao" : "leitura_ia";

      await supabase
        .from("extracao_jobs")
        .update({
          etapa: proximaEtapa,
          total: lotes.length,
          concluidos: cursor,
          estado: "processando",
          metadata: {
            ...meta,
            lotes: lotes.map((l) => ({ id: l.id, texto: l.texto })),
            cursorLote: cursor,
            candidatas,
            tokensInput,
            tokensOutput,
            chamadasIa,
            chamadasCache,
            lotesComErro,
            lotesPendentes,
            mensagemStatus,
          },
          atualizado_em: new Date().toISOString(),
        })
        .eq("documento_id", doc.id);

      if (!concluidoLotes) {
        return {
          ok: true,
          concluido: false,
          etapa: "leitura_ia",
          total: lotes.length,
          concluidos: cursor,
          estado: "processando",
          mensagem: mensagemStatus ?? `Lendo lotes com IA (${cursor}/${lotes.length})`,
        };
      }
    }

    // 4) ETAPA: Gravação, Reconciliação do Rol e Ledger
    const metaAtual = ((job.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    let paginas = (metaAtual.paginas as Array<{ numero: number; texto: string }>) ?? [];
    if (!paginas || paginas.length === 0) {
      const carregado = await carregarTextoIntegral(supabase, doc.id);
      paginas = carregado.paginas;
    }
    const candidatas = (metaAtual.candidatas as UnidadeExtraida[]) ?? [];
    const fonteUsada = (metaAtual.fonteUsada as string) ?? "storage";
    const totalPaginas = (metaAtual.totalPaginas as number) ?? paginas.length;
    const totalCaracteres = (metaAtual.totalCaracteres as number) ?? 0;
    const tipologiaDetectada = (metaAtual.tipologiaDetectada as string) ?? "predio";
    const avisoTipologiaDivergente = metaAtual.avisoTipologiaDivergente as any;
    const descritivaTentativa = metaAtual.descritivaTentativa as any;
    const descritivaRol = metaAtual.descritivaRol as any;
    const tokensInput = (metaAtual.tokensInput as number) ?? 0;
    const tokensOutput = (metaAtual.tokensOutput as number) ?? 0;
    const chamadasIa = (metaAtual.chamadasIa as number) ?? 0;
    const chamadasCache = (metaAtual.chamadasCache as number) ?? 0;
    const lotes = (metaAtual.lotes as Lote[]) ?? [];
    const linhasLidasQuadroIds = new Set((metaAtual.linhasLidasQuadroIds as string[]) ?? []);
    const lotesComErro = (metaAtual.lotesComErro as number) ?? 0;
    const lotesPendentes = (metaAtual.lotesPendentes as Array<{ lote: number; motivo: string; texto?: string }>) ?? [];

    const chunks: ChunkRow[] = paginas.map((p, idx) => ({
      id: `pag-${p.numero}`,
      conteudo: p.texto,
      metadata: {
        ordem_global: idx,
        pagina_inicio: p.numero,
        pagina_fim: p.numero,
        bloco: p.numero,
        trecho: idx,
      },
    }));
    const censo = construirCenso(doc.id, chunks);
    const registros = segmentarRegistros(paginas, doc.id);
    const registrosGrupo = registros.filter((r) => r.padrao_ancora.startsWith("grupo:")).length;
    const registrosIndividual = registros.length - registrosGrupo;

    const lidasPelaIa = new Set<string>();
    for (const c of candidatas) {
      const lin = censo.candidatas.find((l) => {
        if (c.linha_id && l.linha_id === c.linha_id) return true;
        const id = identificadorDaLinha(l.texto);
        const blocoLinha = l.bloco_contexto ?? id?.sufixoBloco ?? null;
        return id && id.numero === c.numero && (c.bloco == null || blocoLinha === c.bloco || id?.sufixoBloco === c.bloco);
      });
      if (lin) {
        c.linha_id = lin.linha_id;
        lidasPelaIa.add(lin.linha_id);
      }
      for (const m of c.medidas ?? []) {
        if (m.linha_id && censo.porId.has(m.linha_id)) {
          lidasPelaIa.add(m.linha_id);
        }
      }
    }

    const semLeitura = censo.candidatas.filter(
      (l) => !linhasLidasQuadroIds.has(l.linha_id) && !lidasPelaIa.has(l.linha_id),
    );

    const { unidades, conflitos, escala, somasHipoteses, regras, medidasDescartadas, orfas } =
      consolidar(candidatas, conhecidas, censo, registros, tipologiaDetectada);

    const diagnostico: DiagnosticoExtracao = {
      leitura: "quadro_ia",
      registros_bloco_individual: registrosIndividual,
      registros_bloco_grupo: registrosGrupo,
      tentativa_descritiva: { ...descritivaTentativa, caminho_usado: "censo_de_linhas" },
      rol_artigo_2: descritivaRol
        ? {
            total_declarado: descritivaRol.total_declarado,
            identificadores: descritivaRol.identificadores,
          }
        : null,
      total_trechos: chunks.length,
      trechos_selecionados: chunks.length,
      prefiltro: `linhas candidatas ${censo.candidatas.length}`,
      linhas_do_quadro: linhasLidasQuadroIds.size,
      total_lotes: lotes.length,
      lotes_processados: lotes.length,
      lotes_com_erro: lotesComErro,
      lotes_pendentes: lotesPendentes,
      chamadas_ia: chamadasIa,
      chamadas_em_cache: chamadasCache,
      erros: [],
      fonte: fonteUsada,
      total_paginas: totalPaginas,
      total_caracteres: totalCaracteres,
      tipologia_detectada: tipologiaDetectada,
      tipologia_divergente: avisoTipologiaDivergente,
      orfas,
      balanco: montarBalanco({
        linhasCandidatas: censo.candidatas.length,
        lidasPeloParser: censo.candidatas.filter((l) => linhasLidasQuadroIds.has(l.linha_id)).length,
        lidasPelaIa: censo.candidatas.filter((l) => lidasPelaIa.has(l.linha_id)).length,
        naoLidas: semLeitura.length,
        unidades,
        semCorrespondencia: orfas.length,
      }),
      conflitos,
      escala_fracao: escala,
      somas_hipoteses: somasHipoteses,
      medidas_descartadas: medidasDescartadas,
      regra_area: regras.includes("area_privativa") ? "area_privativa" : null,
      unidades_encontradas: unidades.length,
      unidades_com_fracao: unidades.filter((u) => u.fracao_ideal != null).length,
      unidades_com_area: unidades.filter((u) => u.area_m2 != null).length,
      unidades_confianca_alta: unidades.filter((u) => u.confianca === "alta").length,
      unidades_pendentes_revisao: unidades.filter((u) => u.confianca !== "alta").length,
      duracao_ms: 0,
      linhas_nao_lidas: semLeitura.map((l) => ({
        linha_id: l.linha_id,
        texto: l.texto,
        pagina: l.pagina,
      })),
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
    };

    const unidadesFinais = await persistirExtracao({
      supabase,
      doc,
      unidades,
      diagnostico,
      conhecidas,
      escala,
      qtdEsperada: (cond?.qtd_unidades as number | null) ?? null,
      force: false,
      pendenciasExtras: semLeitura.length + orfas.length,
      registros,
    });

    const temPendenciasLotes = lotesPendentes.length > 0;
    const estadoFinal: "pronto" | "pronto_com_pendencias" = temPendenciasLotes
      ? "pronto_com_pendencias"
      : "pronto";

    const totalLidos = lotes.length - lotesPendentes.length;
    const mensagemFinal = temPendenciasLotes
      ? `${totalLidos} de ${lotes.length} trechos lidos. ${lotesPendentes.length} não puderam ser lidos — Reler trechos pendentes.`
      : null;

    await supabase
      .from("extracao_jobs")
      .update({
        etapa: "concluido",
        total: lotes.length || 4,
        concluidos: lotes.length || 4,
        estado: estadoFinal,
        erro: mensagemFinal,
        metadata: {
          ...metaAtual,
          lotes: undefined,
          paginas: undefined,
          textoIntegral: undefined,
          diagnostico,
        },
        atualizado_em: new Date().toISOString(),
      })
      .eq("documento_id", doc.id);

    return {
      ok: true,
      concluido: true,
      etapa: "concluido",
      total: lotes.length || 4,
      concluidos: lotes.length || 4,
      estado: estadoFinal,
      unidades: unidadesFinais,
      mensagem: mensagemFinal,
      lotes_pendentes: temPendenciasLotes ? lotesPendentes : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("extracao_jobs")
      .update({
        estado: "falhou",
        erro: msg,
        atualizado_em: new Date().toISOString(),
      })
      .eq("documento_id", doc.id);
    throw err;
  }
}

export async function extrairESalvarSugestaoUnidades(
  supabase: SupabaseClient,
  documentoId: string,
  apiKey: string,
  opts: { force?: boolean; paginaInicio?: number; paginaFim?: number } = {},
): Promise<UnidadeExtraida[]> {
  let r = await processarExtracaoRodada(supabase, documentoId, apiKey, {
    reiniciar: true,
    paginaInicio: opts.paginaInicio,
    paginaFim: opts.paginaFim,
  });

  let rodadas = 1;
  while (!r.concluido && rodadas < 50) {
    r = await processarExtracaoRodada(supabase, documentoId, apiKey, {
      paginaInicio: opts.paginaInicio,
      paginaFim: opts.paginaFim,
    });
    rodadas++;
    if (!r.ok || r.estado === "falhou") {
      throw new Error(r.erro || "Falha durante o processamento da extração.");
    }
  }

  if (!r.ok || r.estado === "falhou") {
    throw new Error(r.erro || "Falha ao extrair unidades.");
  }

  return r.unidades ?? [];
}

/**
 * Persistência comum aos dois caminhos de leitura (descritivo determinístico e
 * IA por linha): sugestão, preenchimento de campos vazios, perfil documental e
 * estado do documento. Nunca sobrescreve dado já preenchido manualmente.
 */
async function persistirExtracao(entrada: {
  supabase: SupabaseClient;
  doc: { id: string; condominio_id: string };
  unidades: UnidadeExtraida[];
  diagnostico: DiagnosticoExtracao;
  conhecidas: Array<{ bloco: string | null; numero: string }>;
  escala: EscalaFracao | null;
  qtdEsperada: number | null;
  force: boolean;
  pendenciasExtras: number;
  registros?: RegistroUnidade[];
}): Promise<UnidadeExtraida[]> {
  const { supabase, doc, unidades, diagnostico, escala } = entrada;
  const registros = entrada.registros ?? [];
  validarCoberturaExtracao(unidades, diagnostico, entrada.qtdEsperada);

  // 1) Grava em documento_registros TODOS os registros segmentados
  const { error: delRegError } = await supabase
    .from("documento_registros")
    .delete()
    .eq("documento_id", doc.id);
  if (delRegError) {
    console.error("[persistirExtracao] erro ao limpar documento_registros:", delRegError);
  }

  if (registros.length > 0) {
    const batchSize = 250;
    for (let i = 0; i < registros.length; i += batchSize) {
      const batch = registros.slice(i, i + batchSize).map((r) => ({
        condominio_id: doc.condominio_id,
        documento_id: doc.id,
        registro_id: r.registro_id,
        pagina: r.pagina,
        offset_inicio: r.offset_inicio,
        offset_fim: r.offset_fim,
        escopo: r.escopo,
        numero: r.numero,
        sufixo: r.sufixo,
        ancora: r.ancora || r.numero,
        padrao_ancora: r.padrao_ancora,
        texto: r.texto,
      }));
      const { error: insRegError } = await supabase.from("documento_registros").insert(batch);
      if (insRegError) {
        console.error("[persistirExtracao] erro ao gravar documento_registros:", insRegError);
      }
    }
  }

  // 2) Reconciliação do rol e dos registros: toda unidade do rol aparece, mesmo sem medidas
  const unidadesFinais: UnidadeExtraida[] = [...unidades];
  const numerosExistentes = new Set(unidadesFinais.map((u) => u.numero));

  // Adiciona unidades do rol que não foram lidas
  const idsDoRol = diagnostico.rol_artigo_2?.identificadores ?? [];
  for (const idRol of idsDoRol) {
    if (!numerosExistentes.has(idRol)) {
      const matchingReg = registros.find(
        (r) => r.numero === idRol || `${r.escopo ? r.escopo + " " : ""}${r.numero}` === idRol
      );
      unidadesFinais.push({
        bloco: matchingReg?.escopo ?? null,
        numero: matchingReg?.numero ?? idRol,
        tipo: "outro",
        fracao_ideal: null,
        area_m2: null,
        medidas: [],
        medidas_descartadas: [],
        regras_aplicadas: ["Consta do rol do Artigo 2 mas sem medidas no texto"],
        estado: "nao_lido",
        origem: "ausente",
        motivos: ["Consta do rol do Artigo 2 mas sem medidas no texto"],
        trecho_fonte: matchingReg?.texto ?? null,
        linha_id: matchingReg?.registro_id ?? null,
        confianca: "conflito",
      });
      numerosExistentes.add(idRol);
    }
  }

  // Adiciona registros segmentados não vinculados a unidades lidas
  for (const reg of registros) {
    if (!numerosExistentes.has(reg.numero) && !reg.motivo_descarte) {
      unidadesFinais.push({
        bloco: reg.escopo ?? null,
        numero: reg.numero,
        tipo: "outro",
        fracao_ideal: null,
        area_m2: null,
        medidas: [],
        medidas_descartadas: [],
        regras_aplicadas: ["Registro identificado pela âncora, mas sem medidas extraídas"],
        estado: "nao_lido",
        origem: "rotulo",
        motivos: ["Registro identificado pela âncora, mas sem medidas extraídas"],
        trecho_fonte: reg.texto,
        linha_id: reg.registro_id,
        confianca: "conflito",
      });
      numerosExistentes.add(reg.numero);
    }
  }

  // Normaliza estados, origens e trechos fonte de cada unidade
  for (const u of unidadesFinais) {
    const matchingReg = registros.find(
      (r) => r.numero === u.numero && (u.bloco ? r.escopo === u.bloco : true)
    );
    if (!u.trecho_fonte) {
      u.trecho_fonte = u.fracao_trecho || u.area_trecho || matchingReg?.texto || null;
    }
    if (!u.linha_id && matchingReg) {
      u.linha_id = matchingReg.registro_id;
    }
    if (u.area_m2 == null) {
      u.estado = "nao_lido";
    } else if (!u.estado) {
      if (u.fracao_ideal == null) {
        u.estado = "lido_com_ressalva";
      } else if (
        u.confianca !== "alta" ||
        (u.medidas_descartadas && u.medidas_descartadas.length > 0)
      ) {
        u.estado = "lido_com_ressalva";
      } else {
        u.estado = "lido";
      }
    }
    if (!u.origem) {
      u.origem = diagnostico.leitura === "secao_descritiva" ? "rotulo" : "ia";
    }
    if (!u.motivos || u.motivos.length === 0) {
      u.motivos = [
        ...(u.regras_aplicadas ?? []),
        ...(u.medidas_descartadas?.map((m) => `Rejeitada (${m.medida.campo}): ${m.motivo}`) ?? []),
      ];
      if (u.area_m2 == null && !u.motivos.includes("area_privativa_ausente")) {
        u.motivos.push("area_privativa_ausente");
      }
      if (u.estado === "nao_lido" && u.motivos.length === 0) {
        u.motivos = ["Sem medidas extraídas para esta unidade"];
      }
    } else if (u.area_m2 == null && !u.motivos.includes("area_privativa_ausente")) {
      u.motivos.push("area_privativa_ausente");
    }
  }

  // 3) Grava extracao_ledger (uma linha por unidade)
  const { error: delLedgerError } = await supabase
    .from("extracao_ledger")
    .delete()
    .eq("documento_id", doc.id);
  if (delLedgerError) {
    console.error("[persistirExtracao] erro ao limpar extracao_ledger:", delLedgerError);
  }

  const ledgerRows = unidadesFinais.map((u) => ({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    registro_id: u.linha_id?.includes(":") ? u.linha_id : null,
    escopo: u.bloco ?? null,
    numero: u.numero,
    estado: u.estado ?? "lido",
    origem: u.origem ?? "rotulo",
    motivos: u.motivos ?? [],
    medidas: u.medidas ?? [],
    medidas_rejeitadas: u.medidas_descartadas ?? [],
    trecho_fonte: u.trecho_fonte ?? null,
  }));

  if (ledgerRows.length > 0) {
    const batchSize = 250;
    for (let i = 0; i < ledgerRows.length; i += batchSize) {
      const batch = ledgerRows.slice(i, i + batchSize);
      const { error: insLedgerError } = await supabase
        .from("extracao_ledger")
        .insert(batch as any);
      if (insLedgerError) {
        console.error("[persistirExtracao] erro ao gravar extracao_ledger:", insLedgerError);
      }
    }
  }

  // 4) Atualiza sugestoes_unidades (com todas as unidades do rol)
  const { error: deleteError } = await supabase
    .from("sugestoes_unidades")
    .delete()
    .eq("documento_id", doc.id);
  if (deleteError) throw new Error(deleteError.message);

  const pendentes = unidadesFinais.filter((u) => u.confianca !== "alta" || u.estado !== "lido");
  const balancoFinal = diagnostico.balanco;
  const status =
    pendentes.length > 0 || entrada.pendenciasExtras > 0 || balancoFinal?.fecha === false
      ? "pendente_revisao"
      : "pendente";
  if (balancoFinal?.fecha === false) {
    console.error("[extracao] balanço não fecha", { documento_id: doc.id, balanco: balancoFinal });
  }
  const { error: insertError } = await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades: unidadesFinais, diagnostico },
    status,
  });
  if (insertError) throw new Error(insertError.message);

  // A leitura NUNCA cria nem altera unidades por conta própria. Tudo fica na
  // sugestão até o usuário confirmar em "Revisar e importar", que aplica as
  // regras de permissão e o limite de unidades do plano.

  await supabase.from("perfis_documentais_condominio").upsert(
    {
      condominio_id: doc.condominio_id,
      documento_id: doc.id,
      escala_fracao: escala,
      regra_area: diagnostico.regra_area,
      tolerancias: {
        fracao_absoluta: 0.000001,
        fracao_relativa: 0.001,
        area_absoluta: 0.02,
        area_relativa: 0.001,
        soma_fracoes: 0.005,
      },
      validacoes: diagnostico.validacoes ?? [],
      diagnostico,
    },
    { onConflict: "condominio_id" },
  );
  await supabase
    .from("documentos")
    .update({
      processamento_meta: {
        etapa: "concluido",
        extracao_status: status,
        diagnostico,
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", doc.id);
  return unidadesFinais;
}

