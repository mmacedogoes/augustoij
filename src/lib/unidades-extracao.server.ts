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
  type Conhecida,
  type LinhaCenso,
} from "./censo-linhas";


export const CampoMedidaSchema = z.enum([
  "area_privativa",
  "area_comum",
  "area_global",
  "area_equivalente",
  "fracao_terreno",
  "fracao_coisas_comuns",
  "coeficiente_rateio",
  "indeterminado",
]);

export const EscalaMedidaSchema = z.enum([
  "percentual",
  "decimal",
  "milesimo",
  "fracao_ordinaria",
  "m2",
]);

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
  vagas_garagem: z.number().int().min(0).max(50).optional(),
  medidas: z.array(MedidaExtraidaSchema).default([]),
  fonte: z.string().nullable().optional(),
  // Compatibilidade somente de leitura com sugestões antigas.
  fracao_ideal: z.number().positive().nullable().optional(),
  area_m2: z.number().positive().nullable().optional(),
  fracao_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  area_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  fracao_trecho: z.string().nullable().optional(),
  area_trecho: z.string().nullable().optional(),
  confianca: z.enum(["alta", "media", "conflito"]).optional(),
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
};


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

const MODELO = "google/gemini-3.7-flash";
const TAMANHO_LOTE = 80_000;
const CONCORRENCIA = 6;
const MAX_TENTATIVAS = 3;
/** Muda sempre que o prompt muda — invalida o cache de extração. */
export const VERSAO_PROMPT = "2026-08-31.linha_id.v1";


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

export async function chamarIaJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<ChamadaIA> {
  let ultimaMensagem = "Falha na comunicação com a IA.";
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90_000);
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
      throw new Error("A resposta da IA foi truncada; o documento será relido em lotes menores.");
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
  throw new Error(ultimaMensagem);
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
function validarProveniencia(unidade: UnidadeExtraida) {
  const medidas: UnidadeExtraida["medidas"] = [];
  const descartadas: NonNullable<UnidadeExtraida["medidas_descartadas"]> = [
    ...(unidade.medidas_descartadas ?? []),
  ];
  for (const medida of unidade.medidas ?? []) {
    if (!trechoContemIdentidade(unidade, medida.trecho, medida.bloco_contexto)) {
      descartadas.push({ medida, motivo: "identidade_nao_confere" });
      continue;
    }
    if (!valorApareceNoTrecho(medida)) {
      descartadas.push({ medida, motivo: "valor_nao_confere" });
      continue;
    }
    medidas.push(medida);
  }
  return { ...unidade, medidas, medidas_descartadas: descartadas };
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
) {
  const grupos = new Map<string, UnidadeExtraida[]>();
  for (const bruta of candidatas) {
    const atualizada = validarProveniencia(normalizarParaCadastro({ ...bruta }, conhecidas));
    const key = chaveUnidade(atualizada.bloco ?? null, atualizada.numero);
    grupos.set(key, [...(grupos.get(key) ?? []), atualizada]);
  }
  const escala = detectarEscalaGlobal(grupos);
  const conflitos: string[] = [];
  const regrasGlobais = new Set<string>();

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
      const global = resolverValorComEvidencia(medidas, "area_global", escala.escala, coerentes);
      const comum = resolverValorComEvidencia(medidas, "area_comum", escala.escala, coerentes);
      let area = privativa.valor;
      let areaMedida = privativa.medida;
      if (area == null && !privativa.conflito && global.valor != null && comum.valor != null) {
        area = Number((global.valor - comum.valor).toFixed(2));
        areaMedida = global.medida;
        regras.push("area_global_menos_comum");
      } else if (area != null) regras.push("area_privativa");

      const terreno = resolverValorComEvidencia(medidas, "fracao_terreno", escala.escala);
      const rateio = resolverValorComEvidencia(medidas, "coeficiente_rateio", escala.escala);
      const coisasComuns = resolverValorComEvidencia(
        medidas,
        "fracao_coisas_comuns",
        escala.escala,
      );
      registrarInvalidas([
        ...privativa.invalidas,
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
      const indeterminadas = medidas.filter((m) => m.campo === "indeterminado");
      const indetArea = indeterminadas.filter((m) => m.escala === "m2");
      const indetFracao = indeterminadas.filter((m) => m.escala !== "m2");
      if (area == null && indetArea.length === 1) {
        const valor = valorCanonico(indetArea[0], escala.escala);
        if (valor != null) {
          area = valor;
          areaMedida = indetArea[0];
          regras.push("promovido_de_indeterminado_area");
        }
      }
      let promocaoFracao: { valor: number; medida: Medida } | null = null;
      if (fracao == null && !terreno.conflito && indetFracao.length === 1) {
        const valor = valorCanonico(indetFracao[0], escala.escala);
        if (fracaoNaFaixa(valor)) promocaoFracao = { valor, medida: indetFracao[0] };
      }

      if (privativa.conflito) conflitos.push(`${key}: área privativa divergente`);
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
    const completa = p.area != null && p.fracao != null;
    const pendentePromocao = p.regras.includes("promocao_desfeita_soma_nao_fecha");
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
        : completa && !pendentePromocao
          ? ("alta" as const)
          : ("media" as const),
      candidatos: Object.fromEntries(
        [...new Set(p.medidas.map((m) => m.campo))].map((campo) => [
          campo,
          p.medidas.filter((m) => m.campo === campo),
        ]),
      ),
      regras_aplicadas: p.regras,
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
    ok: Math.abs(soma - 1) <= 0.005,
    valor: Number(soma.toFixed(8)),
  });
  const identidadesInvalidas = unidades.filter((u) => {
    const p = u.medidas.find((m) => m.campo === "area_privativa");
    const c = u.medidas.find((m) => m.campo === "area_comum");
    const g = u.medidas.find((m) => m.campo === "area_global");
    const pv = p ? numeroBrasileiro(p.valor_bruto) : null;
    const cv = c ? numeroBrasileiro(c.valor_bruto) : null;
    const gv = g ? numeroBrasileiro(g.valor_bruto) : null;
    return pv != null && cv != null && gv != null && !dentroTolerancia(gv, pv + cv, 0.05);
  });
  validacoes.push({
    regra: "area_global_privativa_comum",
    ok: identidadesInvalidas.length === 0,
    unidades: identidadesInvalidas.map((u) => chaveUnidade(u.bloco ?? null, u.numero)),
  });
  const somaAreaPrivativa = unidades.reduce((total, unidade) => total + (unidade.area_m2 ?? 0), 0);
  validacoes.push({
    regra: "soma_area_privativa",
    ok: somaAreaPrivativa > 0,
    valor: Number(somaAreaPrivativa.toFixed(2)),
  });
  const proporcionais = unidades.filter((u) => u.area_m2 != null && u.fracao_ideal != null);
  const ratios = proporcionais.map((u) => (u.fracao_ideal ?? 0) / (u.area_m2 ?? 1));
  const mediaRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  const foraProporcao = proporcionais.filter((u) => {
    const ratio = (u.fracao_ideal ?? 0) / (u.area_m2 ?? 1);
    return mediaRatio > 0 && Math.abs(ratio - mediaRatio) / mediaRatio > 0.25;
  });
  validacoes.push({
    regra: "proporcionalidade_area_fracao",
    ok: foraProporcao.length === 0,
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

/** A IA devolve `linha_id`; o texto vem da nossa própria cópia do lote. */
function resolverLinhas(unidade: UnidadeExtraida, linhas: Record<string, LinhaLote>) {
  return {
    ...unidade,
    medidas: (unidade.medidas ?? []).map((medida) => {
      const linha = medida.linha_id ? linhas[medida.linha_id] : undefined;
      if (!linha) return medida;
      return {
        ...medida,
        trecho: linha.texto,
        pagina: linha.pagina ?? medida.pagina ?? null,
        bloco: linha.bloco ?? medida.bloco ?? null,
        fonte: linha.fonte,
        bloco_contexto: linha.bloco_contexto,
      };
    }),
  };
}

export async function extrairESalvarSugestaoUnidades(

  supabase: SupabaseClient,
  documentoId: string,
  apiKey: string,
  opts: { force?: boolean } = {},
): Promise<UnidadeExtraida[]> {
  const { data: doc, error } = await supabase
    .from("documentos")
    .select("id, condominio_id, nome_arquivo, status_processamento")
    .eq("id", documentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) throw new Error("Documento não encontrado.");
  if (doc.status_processamento !== "pronto")
    throw new Error("Documento ainda não foi processado por completo.");

  const { data: cond, error: condError } = await supabase
    .from("condominios")
    .select("categoria, qtd_unidades, owner_id")
    .eq("id", doc.condominio_id)
    .maybeSingle();
  if (condError) throw new Error(condError.message);
  const { data: existentes, error: unidadesError } = await supabase
    .from("unidades")
    .select("bloco, numero")
    .eq("condominio_id", doc.condominio_id);
  if (unidadesError) throw new Error(unidadesError.message);
  const conhecidas = (existentes ?? []).map((u) => ({
    bloco: u.bloco as string | null,
    numero: String(u.numero),
  }));

  const inicio = Date.now();
  const chunks = await carregarTodosChunks(supabase, doc.id);

  // 1) Parser determinístico: quadros em Markdown não precisam de IA.
  const { extrairUnidadesDeQuadros } = await import("./quadro-parser");
  const quadro = extrairUnidadesDeQuadros(chunks);

  // 2) Pré-filtro: só vai para a IA o que pode conter unidade.
  const restantes = chunks.filter((c) => !quadro.chunksResolvidos.has(c.id));
  const { chunks: selecionados, prefiltro } = selecionarChunksRelevantes(restantes);
  const lotes = quadro.linhasLidas > 0 && selecionados.length === 0 ? [] : montarLotes(selecionados);
  const diagnostico: DiagnosticoExtracao = {
    total_trechos: chunks.length,
    trechos_selecionados: selecionados.length,
    prefiltro,
    linhas_do_quadro: quadro.linhasLidas,
    total_lotes: lotes.length,
    lotes_processados: 0,
    lotes_com_erro: 0,
    chamadas_ia: 0,
    chamadas_em_cache: 0,
    erros: [],
  };
  if (lotes.length === 0 && quadro.linhasLidas === 0) {
    const mensagem =
      "Nenhum trecho sobre unidades, áreas ou frações foi localizado no texto indexado.";
    await persistirFalha(supabase, doc, mensagem, diagnostico);
    throw new ExtracaoIncompletaError(mensagem, diagnostico);
  }

  const categoria = getCategoriaMeta(normalizeCategoria(cond?.categoria as string | null));
  const system =
    "Extraia dados literais de unidades autônomas de uma convenção condominial brasileira. " +
    categoria.vocabIA +
    " " +
    "Cada linha do texto recebido vem prefixada por um identificador do tipo L0001. " +
    "Em cada medida, devolva o campo linha_id com o identificador da linha de onde o valor foi lido; NÃO redigite o trecho. " +
    "Leia cada trecho integralmente. Linhas agrupadas como '701A, 901A e 1501A' devem gerar uma linha para cada unidade somente se o texto atribuir explicitamente os mesmos valores ao grupo. " +
    "Devolva TODAS as medidas numéricas que o documento associa à unidade, cada uma com seu rótulo. " +
    "Se o cabeçalho da coluna não estiver visível no trecho recebido, use campo indeterminado; nunca adivinhe o rótulo. " +
    "Preserve valor_bruto exatamente como impresso, inclusive %, ‰, barra e vírgula. Não converta escalas. " +
    "É proibido calcular, estimar, completar séries ou copiar valores por semelhança. " +
    'Responda apenas JSON: {"unidades":[{"bloco":string|null,"numero":string,"tipo":"apartamento|casa|lote|terreno|sala_comercial|loja|galpao|vaga_avulsa|outro","vagas_garagem":number,"medidas":[{"campo":"area_privativa|area_comum|area_global|area_equivalente|fracao_terreno|fracao_coisas_comuns|coeficiente_rateio|indeterminado","valor_bruto":string,"escala":"percentual|decimal|milesimo|fracao_ordinaria|m2","linha_id":string}]}],"diagnostico":{"total_declarado_no_texto":number|null,"quadro_fracoes_encontrado":boolean,"observacao":string|null}}.';

  const candidatas: UnidadeExtraida[] = [...quadro.unidades];
  let tokensInput = 0;
  let tokensOutput = 0;
  let ultimoLogId: string | null = null;
  let ultimoRunId: string | null = null;
  const resultados = new Array<{
    unidades: UnidadeExtraida[];
    diagnostico?: DiagnosticoExtracao;
    usage: { prompt_tokens: number; completion_tokens: number };
    cache: boolean;
    aigLogId: string | null;
    aigRunId: string | null;
  } | null>(lotes.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= lotes.length) return;
      const lote = lotes[i];
      try {
        const hash = await hashLote(lote.texto);
        const cacheado = await lerCacheExtracao(supabase, hash);
        const bruto =
          cacheado ??
          (await (async () => {
            const chamada = await chamarIaJson(
              apiKey,
              system,
              `Arquivo: ${doc.nome_arquivo}\nLote ${i + 1}/${lotes.length}:\n${lote.texto}`,
            );
            tokensInput += chamada.usage.prompt_tokens;
            tokensOutput += chamada.usage.completion_tokens;
            ultimoLogId = chamada.aigLogId;
            ultimoRunId = chamada.aigRunId;
            await gravarCacheExtracao(supabase, hash, chamada.data);
            return chamada.data;
          })());
        const parsed = bruto as { unidades?: unknown[]; diagnostico?: DiagnosticoExtracao };
        const resultado = z.array(UnidadeExtraidaSchema).safeParse(parsed.unidades ?? []);
        if (!resultado.success) {
          throw new Error(
            `JSON incompatível no lote ${i + 1}: ${resultado.error.issues[0]?.message ?? "formato inválido"}`,
          );
        }
        resultados[i] = {
          unidades: resultado.data.map((u) => resolverLinhas(u, lote.linhas)),
          diagnostico: parsed.diagnostico,
          usage: { prompt_tokens: 0, completion_tokens: 0 },
          cache: Boolean(cacheado),
          aigLogId: ultimoLogId,
          aigRunId: ultimoRunId,
        };
      } catch (errorLote) {
        diagnostico.lotes_com_erro = (diagnostico.lotes_com_erro ?? 0) + 1;
        diagnostico.erros?.push(
          `Lote ${i + 1}: ${errorLote instanceof Error ? errorLote.message : "falha desconhecida"}`,
        );
      }
      await supabase
        .from("documentos")
        .update({
          processamento_meta: {
            etapa: "interpretacao_unidades",
            lotes_concluidos: resultados.filter(Boolean).length,
            total_lotes: lotes.length,
            lotes_com_erro: diagnostico.lotes_com_erro,
            atualizado_em: new Date().toISOString(),
          },
        })
        .eq("id", doc.id);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, Math.max(1, lotes.length)) }, () => worker()),
  );
  for (const resultado of resultados) {
    if (!resultado) continue;
    candidatas.push(...resultado.unidades);
    diagnostico.lotes_processados = (diagnostico.lotes_processados ?? 0) + 1;
    if (resultado.cache) diagnostico.chamadas_em_cache = (diagnostico.chamadas_em_cache ?? 0) + 1;
    else diagnostico.chamadas_ia = (diagnostico.chamadas_ia ?? 0) + 1;
    diagnostico.total_declarado_no_texto ??=
      resultado.diagnostico?.total_declarado_no_texto ?? null;
    diagnostico.quadro_fracoes_encontrado =
      diagnostico.quadro_fracoes_encontrado === true ||
      quadro.linhasLidas > 0 ||
      resultado.diagnostico?.quadro_fracoes_encontrado === true;
  }
  diagnostico.tokens_input = tokensInput;
  diagnostico.tokens_output = tokensOutput;


  const { unidades, conflitos, escala, somasHipoteses, regras, medidasDescartadas } = consolidar(
    candidatas,
    conhecidas,
  );
  diagnostico.conflitos = conflitos;
  diagnostico.escala_fracao = escala;
  diagnostico.somas_hipoteses = somasHipoteses;
  diagnostico.medidas_descartadas = medidasDescartadas;
  diagnostico.regra_area = regras.includes("area_privativa")
    ? "area_privativa"
    : regras.includes("area_global_menos_comum")
      ? "area_global_menos_comum"
      : null;
  diagnostico.unidades_encontradas = unidades.length;
  diagnostico.unidades_com_fracao = unidades.filter((u) => u.fracao_ideal != null).length;
  diagnostico.unidades_com_area = unidades.filter((u) => u.area_m2 != null).length;
  diagnostico.unidades_confianca_alta = unidades.filter((u) => u.confianca === "alta").length;
  diagnostico.unidades_pendentes_revisao = unidades.filter((u) => u.confianca !== "alta").length;
  diagnostico.duracao_ms = Date.now() - inicio;


  try {
    const { registrarEventoIa } = await import("./uso-ia.server");
    await registrarEventoIa({
      userId: (cond?.owner_id as string | null) ?? null,
      condominioId: doc.condominio_id,
      origem: "importacao_convencao",
      model: MODELO,
      tokensInput,
      tokensOutput,
      aigLogId: ultimoLogId,
      aigRunId: ultimoRunId,
      meta: { etapa: "extracao", documento_id: doc.id, ...diagnostico },
    });
  } catch (telemetryError) {
    console.error("[uso-ia] importacao_convencao:", telemetryError);
  }

  validarCoberturaExtracao(unidades, diagnostico, (cond?.qtd_unidades as number | null) ?? null);
  const deleteQuery = supabase.from("sugestoes_unidades").delete().eq("documento_id", doc.id);
  await (opts.force
    ? deleteQuery
    : deleteQuery.in("status", ["pendente", "pendente_revisao", "falhou"]));
  const pendentes = unidades.filter((u) => u.confianca !== "alta");
  const status =
    pendentes.length > 0 || (diagnostico.lotes_com_erro ?? 0) > 0 ? "pendente_revisao" : "pendente";
  const { error: insertError } = await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades, diagnostico },
    status,
  });
  if (insertError) throw new Error(insertError.message);

  // Preenche automaticamente somente campos vazios de unidades com confiança alta.
  for (const unidade of unidades.filter((u) => u.confianca === "alta")) {
    const existente = conhecidas.find(
      (item) =>
        chaveUnidade(item.bloco, item.numero) ===
        chaveUnidade(unidade.bloco ?? null, unidade.numero),
    );
    if (!existente) {
      await supabase.from("unidades").insert({
        condominio_id: doc.condominio_id,
        bloco: unidade.bloco ?? null,
        numero: unidade.numero,
        tipo: unidade.tipo ?? "apartamento",
        fracao_ideal: unidade.fracao_ideal ?? null,
        area_m2: unidade.area_m2 ?? null,
        vagas_garagem: unidade.vagas_garagem ?? 0,
      });
    } else {
      let atualQuery = supabase
        .from("unidades")
        .select("id, fracao_ideal, area_m2")
        .eq("condominio_id", doc.condominio_id)
        .eq("numero", existente.numero);
      atualQuery =
        existente.bloco == null
          ? atualQuery.is("bloco", null)
          : atualQuery.eq("bloco", existente.bloco);
      const { data: atual } = await atualQuery.maybeSingle();
      if (atual) {
        const patch: Record<string, number> = {};
        if (atual.fracao_ideal == null && unidade.fracao_ideal != null)
          patch.fracao_ideal = unidade.fracao_ideal;
        if (atual.area_m2 == null && unidade.area_m2 != null) patch.area_m2 = unidade.area_m2;
        if (Object.keys(patch).length)
          await supabase.from("unidades").update(patch).eq("id", atual.id);
      }
    }
  }
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
  return unidades;
}
