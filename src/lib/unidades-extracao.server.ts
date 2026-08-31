import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoriaMeta, normalizeCategoria } from "@/lib/categorias-condominio";
import { detectarEscalaFracoes, dentroTolerancia, extrairNumerais, inferirEscalaLiteral, normalizarFracao, numeroBrasileiro, type EscalaFracao } from "./fracao-normalizar";

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
  trecho: z.string().min(1),
  pagina: z.number().int().positive().nullable().optional(),
  bloco: z.number().int().min(0).nullable().optional(),
  fonte: z.string().nullable().optional(),
});

const UnidadeExtraidaSchema = z.object({
  bloco: z.string().nullable().optional(),
  numero: z.string().min(1),
  tipo: z.enum([
    "apartamento", "casa", "lote", "terreno", "sala_comercial",
    "loja", "galpao", "vaga_avulsa", "outro",
  ]).optional(),
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
  regras_aplicadas: z.array(z.string()).optional(),
});

export type UnidadeExtraida = z.infer<typeof UnidadeExtraidaSchema>;

export type DiagnosticoExtracao = {
  total_declarado_no_texto?: number | null;
  quadro_fracoes_encontrado?: boolean | null;
  observacao?: string | null;
  total_trechos?: number;
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
  validacoes?: Array<{ regra: string; ok: boolean; valor?: number | null; unidades?: string[]; detalhe?: string }>;
  unidades_confianca_alta?: number;
  unidades_pendentes_revisao?: number;
};

type ChunkRow = {
  id: string;
  conteudo: string;
  metadata: { bloco?: number; trecho?: number; ordem_global?: number; pagina_inicio?: number; pagina_fim?: number } | null;
};

type ChamadaIA = {
  data: unknown;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  aigLogId: string | null;
  aigRunId: string | null;
};

const MODELO = "google/gemini-3.7-flash";
const TAMANHO_LOTE = 18_000;
const MAX_TENTATIVAS = 3;

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
      data = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
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
    const ordem = (ma.ordem_global ?? Number.MAX_SAFE_INTEGER) - (mb.ordem_global ?? Number.MAX_SAFE_INTEGER);
    if (ordem !== 0) return ordem;
    const bloco = (ma.bloco ?? Number.MAX_SAFE_INTEGER) - (mb.bloco ?? Number.MAX_SAFE_INTEGER);
    if (bloco !== 0) return bloco;
    const pagina = (ma.pagina_inicio ?? Number.MAX_SAFE_INTEGER) - (mb.pagina_inicio ?? Number.MAX_SAFE_INTEGER);
    if (pagina !== 0) return pagina;
    const trecho = (ma.trecho ?? Number.MAX_SAFE_INTEGER) - (mb.trecho ?? Number.MAX_SAFE_INTEGER);
    if (trecho !== 0) return trecho;
    return a.id.localeCompare(b.id);
  });
}

export function montarLotes(chunks: ChunkRow[], tamanho = TAMANHO_LOTE) {
  const ordenados = ordenarChunks(chunks);
  const lotes: Array<{ texto: string; fontes: string[] }> = [];
  let partes: string[] = [];
  let fontes: string[] = [];
  let ultimaLinha = "";
  let contextoQuadro = "";
  const cabecalho = (texto: string) => {
    const linhas = texto.split("\n");
    const indice = linhas.findIndex((linha, i) => /^\s*\|.*\|\s*$/.test(linha) && /^\s*\|?\s*:?-{3,}/.test(linhas[i + 1] ?? ""));
    if (indice < 0) return "";
    return linhas.slice(Math.max(0, indice - 2), indice + 2).join("\n");
  };
  for (const chunk of ordenados) {
    const meta = chunk.metadata ?? {};
    const quadro = cabecalho(chunk.conteudo);
    if (quadro) contextoQuadro = quadro;
    const ref = `bloco ${meta.bloco ?? "?"}, páginas ${meta.pagina_inicio ?? "?"}-${meta.pagina_fim ?? "?"}, trecho ${meta.trecho ?? "?"}, ordem ${meta.ordem_global ?? "?"}`;
    const contexto = contextoQuadro && !chunk.conteudo.includes(contextoQuadro) ? `\n[CONTEXTO DO QUADRO]\n${contextoQuadro}` : "";
    const sobreposicao = partes.length === 0 && ultimaLinha ? `\n[LINHA ANTERIOR]\n${ultimaLinha}` : "";
    const parte = `${sobreposicao}${contexto}\n\n[FONTE: ${ref}; id ${chunk.id}]\n${chunk.conteudo}`;
    if (partes.length > 0 && partes.join("").length + parte.length > tamanho) {
      const texto = partes.join("");
      lotes.push({ texto, fontes });
      ultimaLinha = texto.split("\n").filter(Boolean).at(-1) ?? "";
      partes = [];
      fontes = [];
    }
    partes.push(parte);
    fontes.push(ref);
  }
  if (partes.length) lotes.push({ texto: partes.join(""), fontes });
  return lotes;
}

function escaparRegex(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function trechoContemIdentidade(unidade: Pick<UnidadeExtraida, "bloco" | "numero">, trecho: string | null | undefined) {
  if (!trecho) return false;
  const numero = escaparRegex(normalizarParte(unidade.numero));
  const bloco = escaparRegex(normalizarParte(unidade.bloco ?? ""));
  const texto = trecho.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!bloco) return new RegExp(`(^|\\D)${numero}(?=\\D|$)`, "i").test(texto);
  const padroes = [
    `(^|\\W)${numero}\\s*[-/]?\\s*${bloco}(?=\\W|$)`,
    `(^|\\W)${bloco}\\s*[-/]?\\s*${numero}(?=\\W|$)`,
    `(^|\\W)${numero}\\s+(?:do|da)\\s+bloco\\s+${bloco}(?=\\W|$)`,
    `bloco\\s+${bloco}\\s*[,;:-]?\\s*(?:apartamento|apto\\.?|unidade)?\\s*${numero}(?=\\W|$)`,
    `(?:apartamento|apto\\.?|unidade)\\s*${numero}\\s*[,;—-]?\\s*bloco\\s+${bloco}(?=\\W|$)`,
  ];
  return padroes.some((padrao) => new RegExp(padrao, "i").test(texto));
}

function valorApareceNoTrecho(medida: z.infer<typeof MedidaExtraidaSchema>) {
  if (!medida.trecho.includes(medida.valor_bruto.trim())) return false;
  const alvo = medida.escala === "m2"
    ? numeroBrasileiro(medida.valor_bruto)
    : normalizarFracao(medida.valor_bruto, medida.escala as EscalaFracao);
  if (alvo == null) return false;
  return extrairNumerais(medida.trecho).some((literal) => {
    if (medida.escala === "m2") {
      const valor = numeroBrasileiro(literal);
      return valor != null && dentroTolerancia(valor, alvo, 0.02);
    }
    const escala = inferirEscalaLiteral(literal) ?? medida.escala as EscalaFracao;
    const valor = normalizarFracao(literal, escala);
    return valor != null && dentroTolerancia(valor, alvo, 1e-6);
  });
}

function validarProveniencia(unidade: UnidadeExtraida) {
  return {
    ...unidade,
    medidas: unidade.medidas.filter((medida) =>
      valorApareceNoTrecho(medida) && trechoContemIdentidade(unidade, medida.trecho),
    ),
  };
}

export function normalizarParaCadastro(
  unidade: UnidadeExtraida,
  conhecidas: Array<{ bloco: string | null; numero: string }>,
) {
  const direto = conhecidas.find(
    (item) => chaveUnidade(item.bloco, item.numero) === chaveUnidade(unidade.bloco ?? null, unidade.numero),
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
  return normalizarFracao(medida.valor_bruto, explicita ?? escalaGlobal ?? medida.escala as EscalaFracao);
}

function precedenciaFonte(medida: Medida) {
  const texto = `${medida.fonte ?? ""} ${medida.trecho}`.toLowerCase();
  return (/anexo/.test(texto) ? 4 : 0) + (/quadro|tabela|\|/.test(texto) ? 2 : 0) + (/art\.|artigo|paragrafo/.test(texto) ? 0 : 1);
}

export function resolverValorComEvidencia(
  medidas: Medida[],
  campo: CampoMedida,
  escalaGlobal: EscalaFracao | null,
  coerentes = new Set<Medida>(),
) {
  const candidatas = medidas.filter((medida) => medida.campo === campo)
    .map((medida) => ({ medida, valor: valorCanonico(medida, escalaGlobal) }))
    .filter((item): item is { medida: Medida; valor: number } => item.valor != null);
  if (candidatas.length === 0) return { medida: null, valor: null, conflito: false, candidatas: [] as Medida[] };
  const absoluto = campo.startsWith("area_") ? 0.02 : 1e-6;
  const grupos: Array<Array<(typeof candidatas)[number]>> = [];
  for (const candidata of candidatas) {
    const grupo = grupos.find((itens) => dentroTolerancia(itens[0].valor, candidata.valor, absoluto));
    if (grupo) grupo.push(candidata); else grupos.push([candidata]);
  }
  const ranking = grupos.map((grupo) => ({
    grupo,
    aritmetica: grupo.filter(({ medida }) => coerentes.has(medida)).length,
    fonte: Math.max(...grupo.map(({ medida }) => precedenciaFonte(medida))),
    maioria: grupo.length,
  })).sort((a, b) => b.aritmetica - a.aritmetica || b.fonte - a.fonte || b.maioria - a.maioria || a.grupo[0].valor - b.grupo[0].valor);
  const primeira = ranking[0];
  const segunda = ranking[1];
  const empate = segunda && primeira.aritmetica === segunda.aritmetica && primeira.fonte === segunda.fonte && primeira.maioria === segunda.maioria;
  return {
    medida: empate ? null : primeira.grupo[0].medida,
    valor: empate ? null : primeira.grupo[0].valor,
    conflito: Boolean(empate),
    candidatas: candidatas.map(({ medida }) => medida),
  };
}

function detectarEscalaGlobal(grupos: Map<string, UnidadeExtraida[]>) {
  const valores: string[] = [];
  for (const candidatas of grupos.values()) {
    const medidas = candidatas.flatMap((item) => item.medidas)
      .filter((medida) => medida.campo === "fracao_terreno" || medida.campo === "coeficiente_rateio");
    const unica = medidas[0];
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
  const regras = new Set<string>();
  const unidades = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true })).map(([key, grupo]) => {
    const base = grupo[0];
    const medidas = grupo.flatMap((item) => item.medidas);
    const coerentes = new Set<Medida>();
    for (const global of medidas.filter((m) => m.campo === "area_global")) {
      const vg = valorCanonico(global, escala.escala);
      const priv = medidas.find((m) => m.campo === "area_privativa");
      const comum = medidas.find((m) => m.campo === "area_comum");
      const vp = priv ? valorCanonico(priv, escala.escala) : null;
      const vc = comum ? valorCanonico(comum, escala.escala) : null;
      if (vg != null && vp != null && vc != null && dentroTolerancia(vg, vp + vc, 0.05)) {
        coerentes.add(global); coerentes.add(priv); coerentes.add(comum);
      }
    }
    const privativa = resolverValorComEvidencia(medidas, "area_privativa", escala.escala, coerentes);
    const global = resolverValorComEvidencia(medidas, "area_global", escala.escala, coerentes);
    const comum = resolverValorComEvidencia(medidas, "area_comum", escala.escala, coerentes);
    let area = privativa.valor;
    let areaMedida = privativa.medida;
    if (area == null && !privativa.conflito && global.valor != null && comum.valor != null) {
      area = Number((global.valor - comum.valor).toFixed(2));
      areaMedida = global.medida;
      regras.add("area_global_menos_comum");
    } else if (area != null) regras.add("area_privativa");
    const terreno = resolverValorComEvidencia(medidas, "fracao_terreno", escala.escala);
    const rateio = resolverValorComEvidencia(medidas, "coeficiente_rateio", escala.escala);
    const fracao = terreno.valor ?? (terreno.conflito ? null : rateio.valor);
    const fracaoMedida = terreno.medida ?? (terreno.conflito ? null : rateio.medida);
    if (terreno.valor != null) regras.add("fracao_terreno");
    else if (rateio.valor != null) regras.add("coeficiente_rateio");
    if (privativa.conflito) conflitos.push(`${key}: área privativa divergente`);
    if (terreno.conflito) conflitos.push(`${key}: fração do terreno divergente`);
    const conflito = privativa.conflito || terreno.conflito;
    const completa = area != null && fracao != null;
    return {
      ...base,
      medidas,
      tipo: grupo.find((item) => item.tipo)?.tipo,
      vagas_garagem: grupo.find((item) => item.vagas_garagem != null)?.vagas_garagem,
      fracao_ideal: fracao,
      fracao_origem: fracaoMedida ? "documento" as const : "ausente" as const,
      fracao_trecho: fracaoMedida?.trecho ?? null,
      area_m2: area,
      area_origem: areaMedida ? "documento" as const : "ausente" as const,
      area_trecho: areaMedida?.trecho ?? null,
      confianca: conflito ? "conflito" as const : completa ? "alta" as const : "media" as const,
      candidatos: Object.fromEntries([...new Set(medidas.map((m) => m.campo))].map((campo) => [campo, medidas.filter((m) => m.campo === campo)])),
      regras_aplicadas: [...regras],
    } satisfies UnidadeExtraida;
  });
  return { unidades, conflitos, escala: escala.escala, somasHipoteses: escala.somas, regras: [...regras] };
}

export function validarCoberturaExtracao(
  unidades: UnidadeExtraida[],
  diagnostico: DiagnosticoExtracao,
  qtdEsperada: number | null,
) {
  const validacoes: NonNullable<DiagnosticoExtracao["validacoes"]> = [];
  const soma = unidades.reduce((acc, u) => acc + (u.fracao_ideal ?? 0), 0);
  validacoes.push({ regra: "soma_fracoes", ok: Math.abs(soma - 1) <= 0.005, valor: Number(soma.toFixed(8)) });
  const identidadesInvalidas = unidades.filter((u) => {
    const p = u.medidas.find((m) => m.campo === "area_privativa");
    const c = u.medidas.find((m) => m.campo === "area_comum");
    const g = u.medidas.find((m) => m.campo === "area_global");
    const pv = p ? numeroBrasileiro(p.valor_bruto) : null;
    const cv = c ? numeroBrasileiro(c.valor_bruto) : null;
    const gv = g ? numeroBrasileiro(g.valor_bruto) : null;
    return pv != null && cv != null && gv != null && !dentroTolerancia(gv, pv + cv, 0.05);
  });
  validacoes.push({ regra: "area_global_privativa_comum", ok: identidadesInvalidas.length === 0, unidades: identidadesInvalidas.map((u) => chaveUnidade(u.bloco ?? null, u.numero)) });
  const declarado = diagnostico.total_declarado_no_texto ?? qtdEsperada;
  validacoes.push({ regra: "quantidade_unidades", ok: !declarado || declarado === unidades.length, valor: unidades.length, detalhe: declarado ? `declarado: ${declarado}` : "não declarado" });
  validacoes.push({ regra: "lotes_processados", ok: !diagnostico.lotes_com_erro, valor: diagnostico.lotes_com_erro ?? 0 });
  diagnostico.validacoes = validacoes;
  return validacoes;
}

async function persistirFalha(
  supabase: SupabaseClient,
  doc: { id: string; condominio_id: string },
  mensagem: string,
  diagnostico: DiagnosticoExtracao,
) {
  await supabase.from("sugestoes_unidades").delete().eq("documento_id", doc.id).in("status", ["pendente", "falhou"]);
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
  if (doc.status_processamento !== "pronto") throw new Error("Documento ainda não foi processado por completo.");

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
  const conhecidas = (existentes ?? []).map((u) => ({ bloco: u.bloco as string | null, numero: String(u.numero) }));

  const chunks = await carregarTodosChunks(supabase, doc.id);
  const lotes = montarLotes(chunks);
  const diagnostico: DiagnosticoExtracao = {
    total_trechos: chunks.length,
    total_lotes: lotes.length,
    lotes_processados: 0,
    lotes_com_erro: 0,
    erros: [],
  };
  if (lotes.length === 0) {
    const mensagem = "Nenhum trecho sobre unidades, áreas ou frações foi localizado no texto indexado.";
    await persistirFalha(supabase, doc, mensagem, diagnostico);
    throw new ExtracaoIncompletaError(mensagem, diagnostico);
  }

  const categoria = getCategoriaMeta(normalizeCategoria(cond?.categoria as string | null));
  const listaConhecida = conhecidas.length
    ? `Unidades já cadastradas para correspondência (não use para inventar): ${JSON.stringify(conhecidas)}`
    : "Não há lista prévia de unidades.";
  const system =
    "Extraia dados literais de unidades autônomas de uma convenção condominial brasileira. " +
    categoria.vocabIA + " " +
    "Leia cada trecho integralmente. Linhas agrupadas como '701A, 901A e 1501A' devem gerar uma linha para cada unidade somente se o texto atribuir explicitamente os mesmos valores ao grupo. " +
    "Converta identificadores como 601A para bloco A e número 601 quando isso corresponder à lista conhecida. " +
    "Devolva TODAS as medidas numéricas que o documento associa à unidade, cada uma com seu rótulo. " +
    "Se o cabeçalho da coluna não estiver visível no trecho recebido, use campo indeterminado; nunca adivinhe o rótulo. " +
    "Preserve valor_bruto exatamente como impresso, inclusive %, ‰, barra e vírgula. Não converta escalas. " +
    "É proibido calcular, estimar, completar séries ou copiar valores por semelhança. " +
    "Cada medida precisa citar literalmente o identificador e o valor e informar página/bloco da marca FONTE. " +
    'Responda apenas JSON: {"unidades":[{"bloco":string|null,"numero":string,"tipo":"apartamento|casa|lote|terreno|sala_comercial|loja|galpao|vaga_avulsa|outro","vagas_garagem":number,"medidas":[{"campo":"area_privativa|area_comum|area_global|area_equivalente|fracao_terreno|fracao_coisas_comuns|coeficiente_rateio|indeterminado","valor_bruto":string,"escala":"percentual|decimal|milesimo|fracao_ordinaria|m2","trecho":string,"pagina":number|null,"bloco":number|null,"fonte":string|null}],"fonte":string|null}],"diagnostico":{"total_declarado_no_texto":number|null,"quadro_fracoes_encontrado":boolean,"observacao":string|null}}.';

  const candidatas: UnidadeExtraida[] = [];
  let tokensInput = 0;
  let tokensOutput = 0;
  let ultimoLogId: string | null = null;
  let ultimoRunId: string | null = null;
  const resultados = new Array<{
    unidades: UnidadeExtraida[];
    diagnostico?: DiagnosticoExtracao;
    chamada: ChamadaIA;
  } | null>(lotes.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= lotes.length) return;
      try {
        const chamada = await chamarIaJson(
          apiKey,
          system,
          `${listaConhecida}\n\nArquivo: ${doc.nome_arquivo}\nLote ${i + 1}/${lotes.length}:\n${lotes[i].texto}`,
        );
        const parsed = chamada.data as { unidades?: unknown[]; diagnostico?: DiagnosticoExtracao };
        const resultado = z.array(UnidadeExtraidaSchema).safeParse(parsed.unidades ?? []);
        if (!resultado.success) {
          throw new Error(`JSON incompatível no lote ${i + 1}: ${resultado.error.issues[0]?.message ?? "formato inválido"}`);
        }
        resultados[i] = { unidades: resultado.data, diagnostico: parsed.diagnostico, chamada };
      } catch (errorLote) {
        diagnostico.lotes_com_erro = (diagnostico.lotes_com_erro ?? 0) + 1;
        diagnostico.erros?.push(`Lote ${i + 1}: ${errorLote instanceof Error ? errorLote.message : "falha desconhecida"}`);
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
  await Promise.all(Array.from({ length: Math.min(3, lotes.length) }, () => worker()));
  for (const resultado of resultados) {
    if (!resultado) continue;
    candidatas.push(...resultado.unidades);
    diagnostico.lotes_processados = (diagnostico.lotes_processados ?? 0) + 1;
    diagnostico.total_declarado_no_texto ??= resultado.diagnostico?.total_declarado_no_texto ?? null;
    diagnostico.quadro_fracoes_encontrado =
      diagnostico.quadro_fracoes_encontrado === true || resultado.diagnostico?.quadro_fracoes_encontrado === true;
    tokensInput += resultado.chamada.usage.prompt_tokens;
    tokensOutput += resultado.chamada.usage.completion_tokens;
    ultimoLogId = resultado.chamada.aigLogId;
    ultimoRunId = resultado.chamada.aigRunId;
  }

  const { unidades, conflitos, escala, somasHipoteses, regras } = consolidar(candidatas, conhecidas);
  diagnostico.conflitos = conflitos;
  diagnostico.escala_fracao = escala;
  diagnostico.somas_hipoteses = somasHipoteses;
  diagnostico.regra_area = regras.includes("area_privativa") ? "area_privativa" : regras.includes("area_global_menos_comum") ? "area_global_menos_comum" : null;
  diagnostico.unidades_encontradas = unidades.length;
  diagnostico.unidades_com_fracao = unidades.filter((u) => u.fracao_ideal != null).length;
  diagnostico.unidades_com_area = unidades.filter((u) => u.area_m2 != null).length;
  diagnostico.unidades_confianca_alta = unidades.filter((u) => u.confianca === "alta").length;
  diagnostico.unidades_pendentes_revisao = unidades.filter((u) => u.confianca !== "alta").length;

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
      meta: { documento_id: doc.id, ...diagnostico },
    });
  } catch (telemetryError) {
    console.error("[uso-ia] importacao_convencao:", telemetryError);
  }

  validarCoberturaExtracao(unidades, diagnostico, (cond?.qtd_unidades as number | null) ?? null);
  const deleteQuery = supabase.from("sugestoes_unidades").delete().eq("documento_id", doc.id);
  await (opts.force ? deleteQuery : deleteQuery.in("status", ["pendente", "pendente_revisao", "falhou"]));
  const pendentes = unidades.filter((u) => u.confianca !== "alta");
  const status = pendentes.length > 0 || (diagnostico.lotes_com_erro ?? 0) > 0 ? "pendente_revisao" : "pendente";
  const { error: insertError } = await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades, diagnostico },
    status,
  });
  if (insertError) throw new Error(insertError.message);

  // Preenche automaticamente somente campos vazios de unidades com confiança alta.
  for (const unidade of unidades.filter((u) => u.confianca === "alta")) {
    const existente = conhecidas.find((item) => chaveUnidade(item.bloco, item.numero) === chaveUnidade(unidade.bloco ?? null, unidade.numero));
    if (!existente) {
      await supabase.from("unidades").insert({
        condominio_id: doc.condominio_id, bloco: unidade.bloco ?? null, numero: unidade.numero,
        tipo: unidade.tipo ?? "apartamento", fracao_ideal: unidade.fracao_ideal ?? null,
        area_m2: unidade.area_m2 ?? null, vagas_garagem: unidade.vagas_garagem ?? 0,
      });
    } else {
      let atualQuery = supabase
        .from("unidades")
        .select("id, fracao_ideal, area_m2")
        .eq("condominio_id", doc.condominio_id)
        .eq("numero", existente.numero);
      atualQuery = existente.bloco == null
        ? atualQuery.is("bloco", null)
        : atualQuery.eq("bloco", existente.bloco);
      const { data: atual } = await atualQuery.maybeSingle();
      if (atual) {
        const patch: Record<string, number> = {};
        if (atual.fracao_ideal == null && unidade.fracao_ideal != null) patch.fracao_ideal = unidade.fracao_ideal;
        if (atual.area_m2 == null && unidade.area_m2 != null) patch.area_m2 = unidade.area_m2;
        if (Object.keys(patch).length) await supabase.from("unidades").update(patch).eq("id", atual.id);
      }
    }
  }
  await supabase.from("perfis_documentais_condominio").upsert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    escala_fracao: escala,
    regra_area: diagnostico.regra_area,
    tolerancias: { fracao_absoluta: 0.000001, fracao_relativa: 0.001, area_absoluta: 0.02, area_relativa: 0.001, soma_fracoes: 0.005 },
    validacoes: diagnostico.validacoes ?? [],
    diagnostico,
  }, { onConflict: "condominio_id" });
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