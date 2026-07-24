/**
 * Fase 2 do módulo de Contratos de Prestação de Serviços — importação com IA.
 *
 * Fluxo: (1) upload do arquivo OU seleção de um documento do acervo,
 * (2) extração de texto (DOCX/PDF) com fallback para visão em PDF escaneado,
 * (3) IA devolve JSON estruturado com campos + obrigações,
 * (4) tela de revisão do lado cliente, (5) salvarImportacaoContratoServico
 * cria o contrato e as obrigações em uma única etapa transacional.
 *
 * Nada é gravado nas tabelas sem confirmação do usuário. Falha da IA nunca
 * bloqueia o fluxo: retornamos extracaoOk=false com o arquivo salvo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { contratoServicoSchema } from "./schemas";
import { gerarChecklistsInterno } from "./checklists.functions";

const MODEL = "google/gemini-2.5-flash";
const AIG_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

const extractInput = z.object({
  fileBase64: z.string().min(1, "Arquivo vazio"),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1),
  condominioId: z.string().uuid("Selecione um condomínio"),
});

const extractFromDocInput = z.object({
  documentoId: z.string().uuid(),
  condominioId: z.string().uuid(),
});

const listDocsInput = z.object({ condominioId: z.string().uuid() });

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function normText(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function heuristicaTipoServico(texto: string): string | null {
  const t = normText(texto);
  if (!t) return null;
  const regras: Array<[RegExp, string]> = [
    [/porteir|portaria|controle de acesso/, "portaria_controle_acesso"],
    [/limpeza|conservacao|zelador|faxin/, "limpeza_conservacao"],
    [/elevador/, "manutencao_elevadores"],
    [/vigilancia|seguranca patrimonial/, "seguranca_vigilancia"],
    [/jardin/, "jardinagem"],
    [/piscina|bomba d'agua/, "piscina_bombas"],
    [/dedetiz|desratiz|controle de pragas/, "dedetizacao"],
    [/administrador[ea]|administracao predial/, "administradora"],
    [/contabil|contabilidade/, "contabilidade"],
    [/juridic|advocacia|advocatic/, "assessoria_juridica"],
    [/seguro/, "seguros"],
    [/obra|reform/, "obras_reformas"],
    [/energia|gas /, "energia_gas"],
    [/internet|telecom|telefonia/, "telecom_internet"],
  ];
  for (const [re, slug] of regras) if (re.test(t)) return slug;
  return null;
}
async function extrairTextoDoDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = Buffer.from(bytes);
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const t = (value ?? "").trim();
    if (t) return t;
  } catch (e) {
    console.warn("[importar-contrato] docx raw:", (e as Error).message);
  }
  try {
    const { value } = await mammoth.convertToHtml({ buffer: buf });
    return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (e) {
    console.warn("[importar-contrato] docx html:", (e as Error).message);
    return "";
  }
}
async function extrairTextoDoPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : (text ?? "")).trim();
}
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
function buildSystemPrompt(tipos: Array<{ slug: string; nome: string }>): string {
  const lista = tipos.map((t) => `- ${t.slug}: ${t.nome}`).join("\n");
  return `Você é um assistente jurídico brasileiro. Extraia dados de um CONTRATO DE PRESTAÇÃO DE SERVIÇOS firmado por um CONDOMÍNIO EDILÍCIO e devolva APENAS um JSON válido, sem markdown e sem comentários. NUNCA invente dados: todo campo não localizado deve vir como null.

REGRAS:
- Datas no formato aaaa-mm-dd.
- Valores numéricos sem "R$" e sem separador de milhar (ex.: 4500.00).
- Booleanos apenas com previsão expressa; caso contrário null.
- "prestador_documento": CNPJ/CPF com pontuação usual.
- "objeto": resumo objetivo em até 300 caracteres.
- "contratante_nome": nome do CONDOMÍNIO contratante (informativo).
- "terceirizacao_mao_de_obra": true quando o contrato prevê trabalhadores da contratada alocados de forma contínua nas dependências do condomínio; false quando é pontual/eventual; null se indeterminado.

VALORES PERMITIDOS:
- "tipo_servico_slug" (use exatamente o slug ou null):
${lista}
- "indice_reajuste": "igpm" | "ipca" | "inpc" | "outro" | "nenhum"
- "tipo_valor": "mensal" | "global"
- "obrigacoes[].parte": "condominio" | "prestador"
- "obrigacoes[].periodicidade": "unica" | "mensal" | "trimestral" | "semestral" | "anual" | "por_evento"

OBRIGAÇÕES:
- Liste as obrigações relevantes de AMBAS as partes, uma por item, objetivas, sem repetir cláusulas. Indique "clausula_origem" quando identificável.

FORMATO ESPERADO:
{
  "contratante_nome": string|null,
  "prestador_nome": string|null,
  "prestador_documento": string|null,
  "prestador_email": string|null,
  "prestador_telefone": string|null,
  "objeto": string|null,
  "tipo_servico_slug": string|null,
  "terceirizacao_mao_de_obra": boolean|null,
  "data_inicio": string|null,
  "data_fim": string|null,
  "prazo_indeterminado": boolean|null,
  "renovacao_automatica": boolean|null,
  "aviso_previo_dias": number|null,
  "valor": number|null,
  "tipo_valor": "mensal"|"global"|null,
  "dia_vencimento": number|null,
  "indice_reajuste": "igpm"|"ipca"|"inpc"|"outro"|"nenhum"|null,
  "mes_base_reajuste": number|null,
  "multa_rescisoria": string|null,
  "exige_seguro_rc": boolean|null,
  "garantias": string|null,
  "foro": string|null,
  "obrigacoes": [
    { "parte": "condominio"|"prestador", "descricao": string, "periodicidade": "unica"|"mensal"|"trimestral"|"semestral"|"anual"|"por_evento", "clausula_origem": string|null }
  ]
}`;
}

type PartePessoa = "condominio" | "prestador";
type Periodicidade = "unica" | "mensal" | "trimestral" | "semestral" | "anual" | "por_evento";
export type ObrigacaoExtraida = {
  parte: PartePessoa;
  descricao: string;
  periodicidade: Periodicidade;
  clausula_origem: string | null;
};
export type CamposImportacao = {
  contratante_nome: string | null;
  prestador_nome: string | null;
  prestador_documento: string | null;
  prestador_email: string | null;
  prestador_telefone: string | null;
  objeto: string | null;
  tipo_servico_slug: string | null;
  tipo_servico_id: string | null;
  terceirizacao_mao_de_obra: boolean | null;
  data_inicio: string | null;
  data_fim: string | null;
  prazo_indeterminado: boolean | null;
  renovacao_automatica: boolean | null;
  aviso_previo_dias: number | null;
  valor: number | null;
  tipo_valor: "mensal" | "global" | null;
  dia_vencimento: number | null;
  indice_reajuste: "igpm" | "ipca" | "inpc" | "outro" | "nenhum" | null;
  mes_base_reajuste: number | null;
  multa_rescisoria: string | null;
  exige_seguro_rc: boolean | null;
  garantias: string | null;
  foro: string | null;
};

function sanitizar(
  raw: unknown,
  tipos: Array<{ id: string; slug: string }>,
  texto: string,
): { campos: CamposImportacao; obrigacoes: ObrigacaoExtraida[] } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s.slice(0, max) : null;
  };
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const int = (v: unknown, min: number, max: number): number | null => {
    const n = num(v);
    if (n === null) return null;
    const i = Math.round(n);
    return i >= min && i <= max ? i : null;
  };
  const bool = (v: unknown): boolean | null => {
    if (v === true || v === false) return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  };
  const date = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
  };
  const enumStr = <T extends string>(v: unknown, allowed: readonly T[]): T | null => {
    if (typeof v !== "string") return null;
    const lower = v.trim().toLowerCase() as T;
    return allowed.includes(lower) ? lower : null;
  };

  let slug = enumStr(r.tipo_servico_slug, tipos.map((t) => t.slug) as [string, ...string[]]);
  if (!slug) {
    const h = heuristicaTipoServico(texto);
    if (h && tipos.some((t) => t.slug === h)) slug = h;
  }
  const tipoId = slug ? (tipos.find((t) => t.slug === slug)?.id ?? null) : null;

  const campos: CamposImportacao = {
    contratante_nome: str(r.contratante_nome, 200),
    prestador_nome: str(r.prestador_nome, 200),
    prestador_documento: str(r.prestador_documento, 30),
    prestador_email: str(r.prestador_email, 200),
    prestador_telefone: str(r.prestador_telefone, 40),
    objeto: str(r.objeto, 500),
    tipo_servico_slug: slug,
    tipo_servico_id: tipoId,
    terceirizacao_mao_de_obra: bool(r.terceirizacao_mao_de_obra),
    data_inicio: date(r.data_inicio),
    data_fim: date(r.data_fim),
    prazo_indeterminado: bool(r.prazo_indeterminado),
    renovacao_automatica: bool(r.renovacao_automatica),
    aviso_previo_dias: int(r.aviso_previo_dias, 0, 3650),
    valor: num(r.valor),
    tipo_valor: enumStr(r.tipo_valor, ["mensal", "global"] as const),
    dia_vencimento: int(r.dia_vencimento, 1, 31),
    indice_reajuste: enumStr(r.indice_reajuste, ["igpm", "ipca", "inpc", "outro", "nenhum"] as const),
    mes_base_reajuste: int(r.mes_base_reajuste, 1, 12),
    multa_rescisoria: str(r.multa_rescisoria, 1000),
    exige_seguro_rc: bool(r.exige_seguro_rc),
    garantias: str(r.garantias, 1000),
    foro: str(r.foro, 200),
  };

  const rawObr = Array.isArray(r.obrigacoes) ? (r.obrigacoes as unknown[]) : [];
  const obrigacoes: ObrigacaoExtraida[] = [];
  for (const it of rawObr.slice(0, 60)) {
    const o = (it ?? {}) as Record<string, unknown>;
    const descricao = str(o.descricao, 800);
    if (!descricao) continue;
    const parte = enumStr(o.parte, ["condominio", "prestador"] as const);
    if (!parte) continue;
    const periodicidade =
      enumStr(o.periodicidade, ["unica", "mensal", "trimestral", "semestral", "anual", "por_evento"] as const) ??
      "mensal";
    obrigacoes.push({ parte, descricao, periodicidade, clausula_origem: str(o.clausula_origem, 200) });
  }
  return { campos, obrigacoes };
}
function camposVazios(): CamposImportacao {
  return {
    contratante_nome: null, prestador_nome: null, prestador_documento: null,
    prestador_email: null, prestador_telefone: null, objeto: null,
    tipo_servico_slug: null, tipo_servico_id: null, terceirizacao_mao_de_obra: null,
    data_inicio: null, data_fim: null, prazo_indeterminado: null,
    renovacao_automatica: null, aviso_previo_dias: null, valor: null,
    tipo_valor: null, dia_vencimento: null, indice_reajuste: null,
    mes_base_reajuste: null, multa_rescisoria: null, exige_seguro_rc: null,
    garantias: null, foro: null,
  };
}

type IaUserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "file"; file: { filename: string; file_data: string } }
    >;

async function chamarIa(apiKey: string, systemPrompt: string, userContent: IaUserContent) {
  const res = await fetch(AIG_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "custom-fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos nas configurações.");
    throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    response: res,
    usage: { input: json.usage?.prompt_tokens, output: json.usage?.completion_tokens },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTipos(sb: any): Promise<Array<{ id: string; slug: string; nome: string }>> {
  const { data, error } = await sb.from("tipos_servico_contrato").select("id, slug, nome").eq("ativo", true);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; slug: string; nome: string }>;
}

// ------ server functions

export const extrairContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => extractInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    const mime = data.mimeType.toLowerCase();
    const isPdf = mime === "application/pdf" || data.fileName.toLowerCase().endsWith(".pdf");
    const isDocx = mime.includes("wordprocessingml") || data.fileName.toLowerCase().endsWith(".docx");
    if (!ALLOWED_MIMES.has(mime) && !isPdf && !isDocx) {
      throw new Error("Formato não suportado. Envie PDF, DOCX ou TXT.");
    }

    const bytes = base64ToBytes(data.fileBase64);
    if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
    if (bytes.byteLength > MAX_BYTES)
      throw new Error(`Arquivo grande demais (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);

    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const arquivoPath = `${context.userId}/servico-${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await context.supabase.storage
      .from("contratos")
      .upload(arquivoPath, bytes, { contentType: mime || "application/octet-stream", upsert: false });
    if (upErr) throw new Error(`Falha ao salvar arquivo: ${upErr.message}`);

    return await tentarExtracao({
      context, condominioId: data.condominioId,
      arquivoPath, documentoId: null,
      bytes, mime, fileName: data.fileName, isPdf, isDocx,
    });
  });

export const listDocumentosContratoDoCondominio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listDocsInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("documentos")
      .select("id, titulo, nome_arquivo, created_at, storage_path")
      .eq("condominio_id", data.condominioId)
      .eq("tipo", "contrato")
      .eq("status_processamento", "pronto")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const extrairContratoDeDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => extractFromDocInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id, condominio_id, storage_path, nome_arquivo")
      .eq("id", data.documentoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.condominio_id !== data.condominioId)
      throw new Error("Documento não pertence ao condomínio selecionado.");

    let textoIndexado = "";
    try {
      const { data: chunks } = await context.supabase
        .from("document_chunks")
        .select("conteudo")
        .eq("documento_id", doc.id)
        .limit(200);
      if (Array.isArray(chunks) && chunks.length > 0) {
        textoIndexado = chunks.map((c) => String((c as { conteudo?: string }).conteudo ?? "")).join("\n").trim();
      }
    } catch (e) {
      console.warn("[importar-contrato] chunks indisponíveis:", (e as Error).message);
    }

    const nome = doc.nome_arquivo ?? "documento";
    const isPdf = /\.pdf$/i.test(nome);
    const isDocx = /\.docx$/i.test(nome);
    let bytes: Uint8Array | null = null;
    if (textoIndexado.length < 400) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const dl = await supabaseAdmin.storage.from("documentos").download(doc.storage_path);
        if (dl.error) throw new Error(dl.error.message);
        bytes = new Uint8Array(await dl.data.arrayBuffer());
      } catch (e) {
        console.warn("[importar-contrato] download acervo falhou:", (e as Error).message);
      }
    }

    return await tentarExtracao({
      context, condominioId: data.condominioId,
      arquivoPath: null, documentoId: doc.id,
      bytes, textoJaIndexado: textoIndexado,
      mime: isPdf ? "application/pdf" : "application/octet-stream",
      fileName: nome, isPdf, isDocx,
    });
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CtxLite = { supabase: any; userId: string };
type TentarExtracao = {
  context: CtxLite;
  condominioId: string;
  arquivoPath: string | null;
  documentoId: string | null;
  bytes: Uint8Array | null;
  textoJaIndexado?: string;
  mime: string;
  fileName: string;
  isPdf: boolean;
  isDocx: boolean;
};

async function tentarExtracao(p: TentarExtracao) {
  const respostaBase = {
    arquivoPath: p.arquivoPath,
    documentoId: p.documentoId,
    contratante_nome: null as string | null,
  };
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { ...respostaBase, extracaoOk: false, motivo: "Serviço de IA indisponível no momento.", campos: camposVazios(), obrigacoes: [] as ObrigacaoExtraida[] };
  }
  try {
    let texto = (p.textoJaIndexado ?? "").trim();
    if (texto.length < 400 && p.bytes) {
      try {
        if (p.isDocx) texto = await extrairTextoDoDocx(p.bytes);
        else if (p.isPdf) texto = await extrairTextoDoPdf(p.bytes);
      } catch (e) {
        console.warn("[importar-contrato] extração local falhou:", (e as Error).message);
      }
    }
    const usaVisao = p.isPdf && texto.length < 400 && !!p.bytes;
    if (!usaVisao && (!texto || texto.trim().length < 40)) {
      return { ...respostaBase, extracaoOk: false, motivo: "Não conseguimos ler o conteúdo do arquivo. Você pode preencher os campos manualmente.", campos: camposVazios(), obrigacoes: [] };
    }

    const tipos = await loadTipos(p.context.supabase);
    const systemPrompt = buildSystemPrompt(tipos);
    const userContent: IaUserContent = usaVisao && p.bytes
      ? [
          { type: "text", text: "Analise este contrato de prestação de serviços e devolva o JSON conforme o system prompt." },
          { type: "file", file: { filename: p.fileName, file_data: `data:${p.mime || "application/pdf"};base64,${bytesToBase64(p.bytes)}` } },
        ]
      : `Analise o contrato de prestação de serviços abaixo e devolva o JSON conforme o system prompt.\n\n=== CONTRATO ===\n${texto.slice(0, 60_000)}`;

    const { content, response, usage } = await chamarIa(apiKey, systemPrompt, userContent);
    const raw = parseJsonLoose(content);
    const { campos, obrigacoes } = sanitizar(raw, tipos, texto);

    try {
      const { registrarEventoIa, extractAigIds } = await import("@/lib/uso-ia.server");
      const ids = extractAigIds(response);
      await registrarEventoIa({
        userId: p.context.userId,
        condominioId: p.condominioId,
        origem: "outro",
        model: MODEL,
        tokensInput: usage.input,
        tokensOutput: usage.output,
        aigLogId: ids.logId,
        aigRunId: ids.runId,
        meta: { arquivoPath: p.arquivoPath, documentoId: p.documentoId, usouVisao: usaVisao },
      });
    } catch (e) {
      console.warn("[importar-contrato] registrarEventoIa:", (e as Error).message);
    }

    return { arquivoPath: p.arquivoPath, documentoId: p.documentoId, contratante_nome: campos.contratante_nome, extracaoOk: true, motivo: null as string | null, campos, obrigacoes };
  } catch (e) {
    console.warn("[importar-contrato] IA falhou:", (e as Error).message);
    return { ...respostaBase, extracaoOk: false, motivo: e instanceof Error ? `Falha ao analisar com IA: ${e.message}. Preencha manualmente.` : "Falha ao analisar com IA. Preencha manualmente.", campos: camposVazios(), obrigacoes: [] };
  }
}

// ------ salvar importação

const obrigacaoImportacaoSchema = z.object({
  parte: z.enum(["condominio", "prestador"]),
  descricao: z.string().trim().min(1).max(1000),
  periodicidade: z.enum(["unica", "mensal", "trimestral", "semestral", "anual", "por_evento"]).default("mensal"),
  clausula_origem: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().max(200).nullable()).default(null),
  origem: z.enum(["ia", "manual"]).default("ia"),
});

const salvarImportacaoSchema = z.object({
  contrato: contratoServicoSchema,
  obrigacoes: z.array(obrigacaoImportacaoSchema).max(200).default([]),
  arquivoPath: z.string().nullable().optional(),
  documentoId: z.string().uuid().nullable().optional(),
});

export const salvarImportacaoContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => salvarImportacaoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const c = data.contrato;
    const payload = {
      condominio_id: c.condominio_id,
      tipo_servico_id: c.tipo_servico_id ?? null,
      situacao: c.situacao,
      prestador_nome: c.prestador_nome,
      prestador_documento: c.prestador_documento,
      prestador_email: c.prestador_email,
      prestador_telefone: c.prestador_telefone,
      objeto: c.objeto,
      terceirizacao_mao_de_obra: c.terceirizacao_mao_de_obra,
      data_inicio: c.data_inicio,
      prazo_indeterminado: c.prazo_indeterminado,
      data_fim: c.prazo_indeterminado ? null : c.data_fim,
      renovacao_automatica: c.renovacao_automatica,
      aviso_previo_dias: c.aviso_previo_dias,
      valor: c.valor,
      tipo_valor: c.tipo_valor,
      dia_vencimento: c.dia_vencimento,
      indice_reajuste: c.indice_reajuste,
      mes_base_reajuste: c.mes_base_reajuste,
      multa_rescisoria: c.multa_rescisoria,
      exige_seguro_rc: c.exige_seguro_rc,
      garantias: c.garantias,
      foro: c.foro,
      arquivo_path: data.arquivoPath ?? null,
      documento_id: data.documentoId ?? null,
      criado_por: context.userId,
    };
    const { data: inserted, error } = await context.supabase
      .from("contratos_servico")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const contratoId = inserted.id as string;

    if (data.obrigacoes.length > 0) {
      const rows = data.obrigacoes.map((o, idx) => ({
        contrato_id: contratoId,
        parte: o.parte,
        descricao: o.descricao,
        periodicidade: o.periodicidade,
        clausula_origem: o.clausula_origem,
        ordem: idx,
        origem: o.origem,
      }));
      const { error: obrErr } = await context.supabase.from("contrato_obrigacoes").insert(rows as never);
      if (obrErr) {
        await context.supabase.from("contratos_servico").delete().eq("id", contratoId);
        throw new Error(`Contrato criado, mas obrigações falharam: ${obrErr.message}`);
      }
    }
    try {
      await gerarChecklistsInterno(context.supabase, contratoId);
    } catch (e) {
      console.warn("Falha ao gerar checklists (importação):", e);
    }
    try {
      const { gerarEventosInterno } = await import("./eventos.functions");
      await gerarEventosInterno(context.supabase, contratoId);
    } catch (e) {
      console.warn("Falha ao gerar eventos (importação):", e);
    }
    return { id: contratoId };
  });

// ------ URL assinada do arquivo

export const getContratoArquivoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: row, error } = await context.supabase
      .from("contratos_servico")
      .select("arquivo_path, documento_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Contrato não encontrado.");

    if (row.arquivo_path) {
      const { data: signed, error: sErr } = await context.supabase.storage
        .from("contratos")
        .createSignedUrl(row.arquivo_path, 3600);
      if (sErr) throw new Error(sErr.message);
      return { url: signed.signedUrl, origem: "upload" as const, nome: baseName(row.arquivo_path) };
    }
    if (row.documento_id) {
      const { data: doc, error: dErr } = await context.supabase
        .from("documentos")
        .select("storage_path, nome_arquivo, titulo")
        .eq("id", row.documento_id)
        .maybeSingle();
      if (dErr) throw new Error(dErr.message);
      if (!doc) throw new Error("Documento vinculado não foi encontrado.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("documentos")
        .createSignedUrl(doc.storage_path, 3600);
      if (sErr) throw new Error(sErr.message);
      return { url: signed.signedUrl, origem: "acervo" as const, nome: doc.titulo ?? doc.nome_arquivo ?? baseName(doc.storage_path) };
    }
    return { url: null, origem: "nenhum" as const, nome: null };
  });

function baseName(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

// ------ Anexar arquivo a um contrato já existente

const anexarInput = z.object({
  id: z.string().uuid(),
  fileBase64: z.string().min(1, "Arquivo vazio"),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1),
});

export const anexarArquivoContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => anexarInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    const bytes = base64ToBytes(data.fileBase64);
    if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
    if (bytes.byteLength > MAX_BYTES) throw new Error("Arquivo maior que 10 MB.");
    const mime = data.mimeType || "application/octet-stream";
    if (!ALLOWED_MIMES.has(mime)) throw new Error("Formato não suportado. Envie PDF, DOCX ou TXT.");

    const { data: row, error: rowErr } = await context.supabase
      .from("contratos_servico")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Contrato não encontrado.");

    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
    const arquivoPath = `${context.userId}/servico-${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await context.supabase.storage
      .from("contratos")
      .upload(arquivoPath, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Falha ao enviar arquivo: ${upErr.message}`);

    const { error: updErr } = await context.supabase
      .from("contratos_servico")
      .update({ arquivo_path: arquivoPath, documento_id: null } as never)
      .eq("id", data.id);
    if (updErr) {
      await context.supabase.storage.from("contratos").remove([arquivoPath]).catch(() => {});
      throw new Error(updErr.message);
    }
    return { ok: true as const, arquivoPath };
  });
