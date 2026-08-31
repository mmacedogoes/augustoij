import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCategoriaMeta, normalizeCategoria } from "@/lib/categorias-condominio";

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
  fracao_ideal: z.number().positive().nullable().optional(),
  area_m2: z.number().positive().nullable().optional(),
  vagas_garagem: z.number().int().min(0).max(50).optional(),
  fracao_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  area_origem: z.enum(["documento", "ausente"]).nullable().optional(),
  fracao_trecho: z.string().nullable().optional(),
  area_trecho: z.string().nullable().optional(),
  fonte: z.string().nullable().optional(),
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
};

type ChunkRow = {
  id: string;
  conteudo: string;
  metadata: { bloco?: number; trecho?: number; pagina_inicio?: number; pagina_fim?: number } | null;
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
  return Math.min(8_000, 1_000 * 2 ** tentativa) + Math.floor(Math.random() * 500);
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
  let texto = "";
  let fontes: string[] = [];
  for (const chunk of ordenados) {
    const meta = chunk.metadata ?? {};
    const ref = `bloco ${meta.bloco ?? "?"}, páginas ${meta.pagina_inicio ?? "?"}-${meta.pagina_fim ?? "?"}, trecho ${meta.trecho ?? "?"}`;
    const parte = `\n\n[FONTE: ${ref}; id ${chunk.id}]\n${chunk.conteudo}`;
    if (texto && texto.length + parte.length > tamanho) {
      lotes.push({ texto, fontes });
      texto = "";
      fontes = [];
    }
    texto += parte;
    fontes.push(ref);
  }
  if (texto.trim()) lotes.push({ texto, fontes });
  return lotes;
}

function numeroApareceNoTrecho(valor: number, trecho: string | null | undefined) {
  if (!trecho) return false;
  const candidatos = new Set([
    String(valor),
    String(valor).replace(".", ","),
    valor.toFixed(2),
    valor.toFixed(2).replace(".", ","),
    valor.toFixed(4),
    valor.toFixed(4).replace(".", ","),
  ]);
  const compacto = trecho.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "");
  return [...candidatos].some((candidato) =>
    compacto.includes(candidato.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "")),
  );
}

function validarProveniencia(unidade: UnidadeExtraida) {
  if (unidade.fracao_ideal != null) {
    if (unidade.fracao_origem !== "documento" || !numeroApareceNoTrecho(unidade.fracao_ideal, unidade.fracao_trecho)) {
      unidade.fracao_ideal = null;
      unidade.fracao_origem = "ausente";
      unidade.fracao_trecho = null;
    }
  }
  if (unidade.area_m2 != null) {
    if (unidade.area_origem !== "documento" || !numeroApareceNoTrecho(unidade.area_m2, unidade.area_trecho)) {
      unidade.area_m2 = null;
      unidade.area_origem = "ausente";
      unidade.area_trecho = null;
    }
  }
  return unidade;
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

function quaseIgual(a: number | null | undefined, b: number | null | undefined) {
  if (a == null || b == null) return true;
  return Math.abs(a - b) < 0.000001;
}

function trechoContemIdentidade(
  unidade: UnidadeExtraida,
  trecho: string | null | undefined,
) {
  if (!trecho) return false;
  const texto = normalizarParte(trecho);
  const numero = normalizarParte(unidade.numero);
  const bloco = normalizarParte(unidade.bloco ?? "");
  if (!bloco) return texto.includes(numero);
  return texto.includes(`${numero}${bloco}`) || texto.includes(`${bloco}${numero}`);
}

type CampoNumerico = "fracao_ideal" | "area_m2";

function resolverValorComEvidencia(
  candidatas: UnidadeExtraida[],
  campo: CampoNumerico,
) {
  const trechoCampo = campo === "fracao_ideal" ? "fracao_trecho" : "area_trecho";
  const origemCampo = campo === "fracao_ideal" ? "fracao_origem" : "area_origem";
  const validas = candidatas.filter((item) => item[campo] != null && item[origemCampo] === "documento");
  if (validas.length === 0) return { candidata: undefined, conflito: false };

  const grupos = new Map<string, UnidadeExtraida[]>();
  for (const item of validas) {
    const valor = item[campo];
    if (valor == null) continue;
    const chave = valor.toFixed(6);
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  if (grupos.size === 1) return { candidata: validas[0], conflito: false };

  const ranking = [...grupos.values()]
    .map((grupo) => ({
      grupo,
      // Uma citação que contém simultaneamente a unidade e o valor é mais
      // confiável que menções vizinhas capturadas por sobreposição do OCR.
      fortes: grupo.filter((item) => trechoContemIdentidade(item, item[trechoCampo])).length,
      evidencias: new Set(
        grupo.map((item) => normalizarParte(`${item[trechoCampo] ?? ""}|${item.fonte ?? ""}`)),
      ).size,
    }))
    .sort((a, b) => b.fortes - a.fortes || b.evidencias - a.evidencias || b.grupo.length - a.grupo.length);

  const primeira = ranking[0];
  const segunda = ranking[1];
  if (!primeira) return { candidata: undefined, conflito: false };
  const venceuPorCitacao = primeira.fortes > 0 && primeira.fortes > (segunda?.fortes ?? 0);
  const venceuPorConsenso =
    primeira.fortes === (segunda?.fortes ?? 0) &&
    primeira.grupo.length > validas.length / 2;
  return {
    candidata: venceuPorCitacao || venceuPorConsenso ? primeira.grupo[0] : undefined,
    conflito: !venceuPorCitacao && !venceuPorConsenso,
  };
}

export function consolidar(
  candidatas: UnidadeExtraida[],
  conhecidas: Array<{ bloco: string | null; numero: string }>,
) {
  const grupos = new Map<string, UnidadeExtraida[]>();
  const conflitos: string[] = [];
  for (const bruta of candidatas) {
    const atualizada = validarProveniencia(normalizarParaCadastro({ ...bruta }, conhecidas));
    const key = chaveUnidade(atualizada.bloco ?? null, atualizada.numero);
    grupos.set(key, [...(grupos.get(key) ?? []), atualizada]);
  }

  const unidades = [...grupos.entries()].map(([key, grupo]) => {
    const base = grupo[0];
    const fracao = resolverValorComEvidencia(grupo, "fracao_ideal");
    const area = resolverValorComEvidencia(grupo, "area_m2");
    if (fracao.conflito) conflitos.push(`${key}: frações divergentes sem evidência conclusiva`);
    if (area.conflito) conflitos.push(`${key}: áreas divergentes sem evidência conclusiva`);
    return {
      ...base,
      tipo: grupo.find((item) => item.tipo)?.tipo,
      vagas_garagem: grupo.find((item) => item.vagas_garagem != null)?.vagas_garagem,
      fracao_ideal: fracao.candidata?.fracao_ideal ?? null,
      fracao_origem: fracao.candidata?.fracao_origem ?? "ausente",
      fracao_trecho: fracao.candidata?.fracao_trecho ?? null,
      area_m2: area.candidata?.area_m2 ?? null,
      area_origem: area.candidata?.area_origem ?? "ausente",
      area_trecho: area.candidata?.area_trecho ?? null,
    } satisfies UnidadeExtraida;
  });
  return { unidades, conflitos };
}

export function validarCoberturaExtracao(
  unidades: UnidadeExtraida[],
  diagnostico: DiagnosticoExtracao,
  qtdEsperada: number | null,
) {
  const total = unidades.length;
  if (diagnostico.lotes_com_erro) {
    throw new ExtracaoIncompletaError(
      `${diagnostico.lotes_com_erro} lote(s) do documento não puderam ser interpretados. Continue a leitura para não perder unidades ou valores.`,
      diagnostico,
    );
  }
  if (diagnostico.conflitos?.length) {
    const unidadesEmConflito = new Set(
      diagnostico.conflitos.map((conflito) => conflito.split(":", 1)[0]),
    ).size;
    throw new ExtracaoIncompletaError(
      `Foram encontrados valores conflitantes sem evidência conclusiva para ${unidadesEmConflito} unidade(s). Nada foi importado até a revisão da fonte.`,
      diagnostico,
    );
  }
  const semFracao = unidades.filter((u) => u.fracao_ideal == null || u.fracao_origem !== "documento");
  if (semFracao.length > 0) {
    const exemplos = semFracao.slice(0, 8).map((u) => `${u.bloco ? `${u.bloco}-` : ""}${u.numero}`).join(", ");
    throw new ExtracaoIncompletaError(
      `${semFracao.length} de ${total} unidade(s) ficaram sem fração ideal comprovada no documento (ex.: ${exemplos}${semFracao.length > 8 ? "…" : ""}). Nenhum valor foi inventado.`,
      diagnostico,
    );
  }
  const comArea = unidades.filter((u) => u.area_m2 != null && u.area_origem === "documento").length;
  if (comArea > 0 && comArea < total) {
    throw new ExtracaoIncompletaError(
      `${total - comArea} de ${total} unidade(s) ficaram sem área comprovada, embora o documento informe áreas para as demais.`,
      diagnostico,
    );
  }
  const declarado = diagnostico.total_declarado_no_texto ?? null;
  if (declarado && declarado !== total) {
    throw new ExtracaoIncompletaError(
      `A convenção declara ${declarado} unidades, mas foram identificadas ${total} com segurança.`,
      diagnostico,
    );
  }
  if (qtdEsperada && qtdEsperada !== total) {
    throw new ExtracaoIncompletaError(
      `Há ${qtdEsperada} unidades cadastradas, mas a convenção permitiu identificar ${total}.`,
      diagnostico,
    );
  }
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
    "Para area_m2 use somente ÁREA REAL PRIVATIVA, nunca área total, comum ou equivalente. " +
    "É proibido calcular, estimar, completar séries ou copiar valores por semelhança. " +
    "Todo número precisa trazer em *_trecho uma citação literal que contenha o identificador da unidade e o próprio valor; sem ambos na mesma citação, devolva null. " +
    'Responda apenas JSON: {"unidades":[{"bloco":string|null,"numero":string,"tipo":"apartamento|casa|lote|terreno|sala_comercial|loja|galpao|vaga_avulsa|outro","fracao_ideal":number|null,"area_m2":number|null,"vagas_garagem":number,"fracao_origem":"documento|ausente","area_origem":"documento|ausente","fracao_trecho":string|null,"area_trecho":string|null,"fonte":string|null}],"diagnostico":{"total_declarado_no_texto":number|null,"quadro_fracoes_encontrado":boolean,"observacao":string|null}}.';

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

  const { unidades, conflitos } = consolidar(candidatas, conhecidas);
  diagnostico.conflitos = conflitos;
  diagnostico.unidades_encontradas = unidades.length;
  diagnostico.unidades_com_fracao = unidades.filter((u) => u.fracao_ideal != null).length;
  diagnostico.unidades_com_area = unidades.filter((u) => u.area_m2 != null).length;

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

  try {
    if (unidades.length === 0) {
      throw new ExtracaoIncompletaError("A IA não localizou unidades com dados literais neste documento.", diagnostico);
    }
    validarCoberturaExtracao(unidades, diagnostico, (cond?.qtd_unidades as number | null) ?? null);
  } catch (validationError) {
    const mensagem = validationError instanceof Error ? validationError.message : "Extração incompleta.";
    await persistirFalha(supabase, doc, mensagem, diagnostico);
    throw validationError;
  }

  const deleteQuery = supabase.from("sugestoes_unidades").delete().eq("documento_id", doc.id);
  await (opts.force ? deleteQuery : deleteQuery.in("status", ["pendente", "falhou"]));
  const { error: insertError } = await supabase.from("sugestoes_unidades").insert({
    condominio_id: doc.condominio_id,
    documento_id: doc.id,
    payload: { unidades, diagnostico },
    status: "pendente",
  });
  if (insertError) throw new Error(insertError.message);
  await supabase
    .from("documentos")
    .update({
      processamento_meta: {
        etapa: "concluido",
        extracao_status: "pronto_para_revisao",
        diagnostico,
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", doc.id);
  return unidades;
}