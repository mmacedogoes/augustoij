/**
 * Importação de contratos com extração automática via Lovable AI.
 *
 * 1) extrairContrato — recebe o arquivo (base64), extrai texto (unpdf/mammoth),
 *    faz fallback para visão quando o PDF é escaneado, envia à IA e devolve
 *    JSON estrito + o caminho no Storage privado "contratos".
 * 2) salvarImportacaoLocacao / salvarImportacaoAdministracao — grava os dados
 *    revisados nas tabelas da Fase 1, criando proprietário/imóvel/contrato
 *    quando necessário. Nada é persistido sem confirmação do usuário.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

const MODEL = "google/gemini-2.5-flash";
const AIG_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ------- Input schemas ---------------------------------------------------
const extractInput = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

// Ajustes leves: nada estrito para permitir o que a IA devolver.
const anyRecord = z.record(z.string(), z.unknown());

const salvarLocInput = z.object({
  arquivoPath: z.string().nullable().optional(),
  proprietario: anyRecord,
  inquilino: anyRecord,
  imovel: anyRecord,
  locacao: anyRecord,
  caucao: anyRecord,
  // Se o usuário selecionou um proprietário/imóvel já existente, mandamos o id
  proprietario_id: z.string().uuid().nullable().optional(),
  imovel_id: z.string().uuid().nullable().optional(),
  subtipo: z.enum(["original", "renovacao"]).nullable().optional(),
  // Se o usuário confirmou criar imóvel novo mesmo com duplicata detectada
  forcar_novo_imovel: z.boolean().optional(),
  // Se subtipo=renovacao e o usuário aceitou atualizar contrato existente
  contrato_existente_id: z.string().uuid().nullable().optional(),
});

const salvarAdmInput = z.object({
  arquivoPath: z.string().nullable().optional(),
  proprietario: anyRecord,
  administrador: anyRecord,
  honorarios: anyRecord,
  vigencia: anyRecord,
  imoveis_administrados: z.array(anyRecord).default([]),
  proprietario_id: z.string().uuid().nullable().optional(),
});

// ------- Helpers ---------------------------------------------------------
function toBuffer(base64: string): Uint8Array {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function extrairTextoDoDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  // No runtime do Worker (nodejs_compat), o build Node do mammoth exige
  // `buffer: Buffer` — usar `arrayBuffer` dispara "Could not find file in
  // options" e o texto volta vazio. Passamos Buffer.from(bytes) e caímos
  // para convertToHtml → strip como fallback quando extractRawText falhar.
  const nodeBuffer = Buffer.from(bytes);
  try {
    const { value } = await mammoth.extractRawText({ buffer: nodeBuffer });
    const txt = (value ?? "").trim();
    if (txt) return txt;
  } catch (e) {
    console.warn("[extrair-contrato] mammoth.extractRawText:", (e as Error).message);
  }
  try {
    const { value } = await mammoth.convertToHtml({ buffer: nodeBuffer });
    return (value ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    console.warn("[extrair-contrato] mammoth.convertToHtml:", (e as Error).message);
    return "";
  }
}

async function extrairTextoDoPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text ?? "").trim();
}

const SYSTEM_PROMPT = `Você é um extrator de dados jurídicos brasileiros especializado em contratos de locação residencial e contratos de administração de imóveis.

REGRAS:
- Detecte primeiro o TIPO do documento: "locacao" ou "administracao" (use null se realmente não conseguir decidir).
- Detecte também o SUBTIPO: "original" ou "renovacao". Considere "renovacao" quando aparecerem termos como "RENOVAÇÃO", "renovar a locação", "aditivo de renovação", ou frases como "contrato firmado em ... considerando o interesse ... em renovar".
- Devolva "confianca" (0-100) — o quão certo você está do TIPO detectado.
- Retorne SOMENTE JSON válido, SEM markdown, SEM comentários, SEM texto antes ou depois.
- Valores monetários como número (ex.: 1750.00, sem "R$" nem separador de milhar).
- Datas no formato aaaa-mm-dd.
- Campos não encontrados = null. NUNCA invente dados. Preserve nomes próprios exatamente como aparecem.
- Percentuais como número (ex.: 2 significa 2%).
- Para booleanos (encargos, possui caução, corrige com rendimento) use true/false. Se não mencionado, use null.

ESQUEMA quando tipo = "locacao":
{
  "tipo":"locacao",
  "subtipo":"original",
  "confianca":0,
  "proprietario":{"nome":null,"cpf":null,"estado_civil":null,"profissao":null,"rg":null,"endereco":null,"email":null,"telefone":null,"banco":null,"agencia":null,"conta":null,"titular":null,"pix":null},
  "inquilino":{"nome":null,"cpf":null,"estado_civil":null,"profissao":null,"rg":null,"endereco":null,"email":null,"telefone":null},
  "imovel":{"descricao":null,"endereco":null,"edificio":null,"numero_unidade":null,"cep":null,"cidade":null,"uf":null,"quartos":null,"vaga_garagem":null},
  "locacao":{"data_contrato_original":null,"data_inicio_vigencia":null,"prazo_meses":null,"valor_aluguel":null,"dia_vencimento":null,"indice_reajuste":null,"periodicidade_reajuste_meses":null,"mes_base_reajuste":null,"encargos_inquilino":{"condominio":null,"agua":null,"luz":null,"iptu":null,"tcr":null},"multa_mora_percent":null,"juros_mora_mensal_percent":null,"multa_rescisoria_multiplicador":null,"multa_rescisoria_proporcional":null,"aviso_previo_dias":null,"foro":null},
  "caucao":{"possui":null,"valor_depositado":null,"tipo":null,"corrige_com_rendimento":null,"data_deposito":null}
}

No subtipo "renovacao", preencha em "locacao":
- "data_contrato_original" com a data do contrato de locação inicial (a que está sendo renovada).
- "data_inicio_vigencia" com a data de início da nova vigência (data da renovação).
- "prazo_meses" com o prazo da renovação (ex.: 24 ou 30).

ESQUEMA quando tipo = "administracao":
{
  "tipo":"administracao",
  "subtipo":"original",
  "confianca":0,
  "proprietario":{"nome":null,"cpf":null,"email":null,"telefone":null,"endereco":null},
  "administrador":{"nome":null,"documento":null,"oab":null,"pix":null,"banco":null,"agencia":null,"conta":null},
  "honorarios":{"percent_honorario_renovacao":null,"percent_honorario_mensal":null,"mora_multa_percent":null,"mora_juros_mensal_percent":null,"mora_indice":null},
  "imoveis_administrados":[{"descricao":null,"endereco":null,"edificio":null,"numero_unidade":null}],
  "vigencia":{"data_inicio":null,"prazo_meses":null}
}`;

async function callGateway(body: unknown): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Configuração de IA ausente (LOVABLE_API_KEY)");
  const res = await fetch(AIG_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "custom-fetch",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos nas configurações.");
    throw new Error(`Falha ao chamar IA (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function extrairJsonDoTexto(raw: string): unknown {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback: tenta achar o primeiro { ... } balanceado
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* noop */
      }
    }
    throw new Error("A IA não devolveu JSON válido. Tente novamente com um arquivo mais legível.");
  }
}

// ------- Server functions -----------------------------------------------

/**
 * Envia o arquivo à IA, retorna { tipo, ...campos } + arquivoPath no Storage.
 * Faz upload primeiro para termos rastreabilidade, mesmo que a extração falhe.
 */
export const extrairContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => extractInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const bytes = toBuffer(data.fileBase64);

    // 1) Upload para Storage
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${context.userId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await context.supabase.storage
      .from("contratos")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha ao salvar arquivo: ${upErr.message}`);

    // 2) Extrair texto local
    const isDocx =
      data.mimeType.includes("wordprocessingml") ||
      data.fileName.toLowerCase().endsWith(".docx");
    const isPdf =
      data.mimeType === "application/pdf" ||
      data.fileName.toLowerCase().endsWith(".pdf");

    let textoLocal = "";
    try {
      if (isDocx) textoLocal = await extrairTextoDoDocx(bytes);
      else if (isPdf) textoLocal = await extrairTextoDoPdf(bytes);
    } catch (e) {
      console.warn("[extrair-contrato] extração local falhou:", (e as Error).message);
    }

    // 3) Escolher payload da IA: texto quando temos, PDF direto quando não temos
    const usaVisao = isPdf && textoLocal.length < 400;
    const userContent = usaVisao
      ? [
          {
            type: "text",
            text: "Analise este contrato e devolva o JSON conforme instruções do system prompt.",
          },
          {
            type: "file",
            file: {
              filename: data.fileName,
              file_data: `data:${data.mimeType};base64,${data.fileBase64}`,
            },
          },
        ]
      : [
          {
            type: "text",
            text: `Analise o conteúdo do contrato abaixo e devolva o JSON conforme instruções.\n\n=== CONTRATO ===\n${textoLocal.slice(0, 60000)}`,
          },
        ];

    const raw = await callGateway({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsed = extrairJsonDoTexto(raw) as { tipo?: string };
    // Nunca bloquear: se o tipo veio nulo, aplicamos heurística por palavras-chave
    // para sugerir um tipo. O usuário confirma/corrige na tela de revisão.
    const p = parsed as Record<string, unknown>;
    const tipoAtual = String(p.tipo ?? "").toLowerCase();
    if (tipoAtual !== "locacao" && tipoAtual !== "administracao") {
      const guess = detectarTipoPorTexto(textoLocal);
      p.tipo = guess.tipo; // pode continuar null
      p.confianca = Math.max(Number(p.confianca ?? 0), guess.confianca);
    }
    // Subtipo por palavras-chave se a IA não classificou
    const subtipoAtual = String(p.subtipo ?? "").toLowerCase();
    if (subtipoAtual !== "original" && subtipoAtual !== "renovacao") {
      p.subtipo = detectarSubtipoPorTexto(textoLocal);
    }
    return {
      arquivoPath: path,
      usouVisao: usaVisao,
      textoExtraido: textoLocal.slice(0, 4000),
      extrai: parsed,
    };
  });

// --------------- Heurísticas de tipo (fallback quando IA falha) ---------
function normText(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function detectarTipoPorTexto(texto: string): { tipo: string | null; confianca: number } {
  const t = normText(texto);
  if (!t) return { tipo: null, confianca: 0 };
  const kwLoc = ["locador", "locadora", "locatario", "locataria", "aluguel", "locacao", "caucao"];
  const kwAdm = ["administracao de bens imoveis", "administracao de imoveis", "honorarios", "contratado", "contratante", "prestacao de servicos"];
  const scoreLoc = kwLoc.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
  const scoreAdm = kwAdm.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
  if (scoreLoc === 0 && scoreAdm === 0) return { tipo: null, confianca: 0 };
  if (scoreLoc >= scoreAdm) return { tipo: "locacao", confianca: Math.min(100, 30 + scoreLoc * 15) };
  return { tipo: "administracao", confianca: Math.min(100, 30 + scoreAdm * 15) };
}
function detectarSubtipoPorTexto(texto: string): "original" | "renovacao" {
  const t = normText(texto);
  if (/renovacao|renovar a locacao|aditivo de renovacao|interesse.*renovar/.test(t)) return "renovacao";
  return "original";
}

// --------------- De-duplicação de imóvel --------------------------------
function normalizeKey(s: unknown): string {
  return normText(String(s ?? "")).replace(/\s+/g, " ").trim();
}
async function buscarImovelDuplicado(
  sb: {
    from: (
      t: string,
    ) => {
      select: (
        c: string,
      ) => {
        eq: (col: string, v: string) => { maybeSingle?: unknown } & Record<string, unknown>;
      };
    };
  },
  proprietarioId: string,
  im: Record<string, unknown>,
): Promise<{ id: string; label: string } | null> {
  // Busca todos os imóveis do proprietário e compara em memória (poucos registros).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("imoveis")
    .select("id, endereco, edificio, numero_unidade, cep")
    .eq("proprietario_id", proprietarioId);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const alvoEd = normalizeKey(im.edificio);
  const alvoEnd = normalizeKey(im.endereco);
  const alvoCep = normalizeKey(im.cep);
  const alvoNu = normalizeKey(im.numero_unidade);
  for (const r of rows) {
    const rEd = normalizeKey(r.edificio);
    const rEnd = normalizeKey(r.endereco);
    const rCep = normalizeKey(r.cep);
    const rNu = normalizeKey(r.numero_unidade);
    if (!alvoNu || !rNu || alvoNu !== rNu) continue;
    const casaEdificio = alvoEd && rEd && alvoEd === rEd;
    const casaEndereco = alvoEnd && rEnd && alvoEnd === rEnd;
    const casaCep = alvoCep && rCep && alvoCep === rCep;
    if (casaEdificio || casaEndereco || casaCep) {
      const label = [r.edificio, r.numero_unidade].filter(Boolean).join(" ").trim()
        || String(r.endereco ?? "");
      return { id: String(r.id), label };
    }
  }
  return null;
}

// Preview de duplicatas antes de gravar (usado pelo review no frontend).
export const checarDuplicataImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      proprietario_id: z.string().uuid(),
      imovel: anyRecord,
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    return await buscarImovelDuplicado(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context.supabase as any,
      data.proprietario_id,
      data.imovel,
    );
  });

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // ajuste de fim de mês (30/01 + 1m → 28/02)
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

// --------------- Helpers de coerção segura ------------------------------
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}
function toBool(v: unknown, def = false): boolean {
  if (v === null || v === undefined) return def;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  return ["true", "sim", "s", "1", "yes", "y"].includes(s);
}
function toDate(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm/aaaa
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/** Grava importação de contrato de locação (proprietário + imóvel + contrato + caução). */
export const salvarImportacaoLocacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => salvarLocInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const owner = context.userId;
    const sb = context.supabase;

    // 1) Proprietário
    let proprietarioId = data.proprietario_id ?? null;
    if (!proprietarioId) {
      const p = data.proprietario as Record<string, unknown>;
      const nome = toStr(p.nome);
      if (!nome) throw new Error("Nome do proprietário é obrigatório");
      const { data: ins, error } = await sb.from("proprietarios").insert({
        owner_admin_id: owner,
        nome,
        cpf: toStr(p.cpf),
        estado_civil: toStr(p.estado_civil),
        profissao: toStr(p.profissao),
        rg: toStr(p.rg),
        endereco: toStr(p.endereco),
        email: toStr(p.email),
        telefone: toStr(p.telefone),
        banco: toStr(p.banco),
        agencia: toStr(p.agencia),
        conta: toStr(p.conta),
        pix: toStr(p.pix),
      }).select("id").single();
      if (error) throw new Error(`Proprietário: ${error.message}`);
      proprietarioId = ins.id as string;
    }

    // 2) Imóvel — com de-duplicação por (edificio|endereco|cep) + numero_unidade
    let imovelId = data.imovel_id ?? null;
    let imovelDuplicado: { id: string; label: string } | null = null;
    if (!imovelId) {
      const im = data.imovel as Record<string, unknown>;
      if (!data.forcar_novo_imovel && proprietarioId) {
        imovelDuplicado = await buscarImovelDuplicado(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sb as any,
          proprietarioId,
          im,
        );
      }
      if (imovelDuplicado) {
        imovelId = imovelDuplicado.id;
      } else {
      const { data: ins, error } = await sb.from("imoveis").insert({
        owner_admin_id: owner,
        proprietario_id: proprietarioId,
        descricao: toStr(im.descricao),
        endereco: toStr(im.endereco),
        edificio: toStr(im.edificio),
        numero_unidade: toStr(im.numero_unidade),
        cep: toStr(im.cep),
        cidade: toStr(im.cidade),
        uf: toStr(im.uf),
        quartos: toInt(im.quartos),
        vaga_garagem: toBool(im.vaga_garagem, false),
      }).select("id").single();
      if (error) throw new Error(`Imóvel: ${error.message}`);
      imovelId = ins.id as string;
      }
    }

    // 3) Contrato de locação — renovação atualiza o contrato existente
    const inq = data.inquilino as Record<string, unknown>;
    const loc = data.locacao as Record<string, unknown>;
    const enc = (loc.encargos_inquilino as Record<string, unknown>) ?? {};

    const dataInicioVig = toDate(loc.data_inicio_vigencia);
    const prazo = toInt(loc.prazo_meses);
    const dataFimVig =
      dataInicioVig && prazo && prazo > 0 ? addMonths(dataInicioVig, prazo) : null;

    const isRenovacao = data.subtipo === "renovacao";

    // Se for renovação, tentar localizar contrato existente para o mesmo imóvel
    let contratoExistenteId = data.contrato_existente_id ?? null;
    if (isRenovacao && !contratoExistenteId && imovelId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existente } = await (sb as any)
        .from("contratos_locacao")
        .select("id, historico_renovacoes, data_contrato_original, data_inicio_vigencia, prazo_meses")
        .eq("imovel_id", imovelId)
        .in("status", ["ativo", "renovado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existente?.id) contratoExistenteId = existente.id as string;
    }

    const basePayload: Record<string, unknown> = {
      owner_admin_id: owner,
      imovel_id: imovelId,
      inquilino_nome: toStr(inq.nome),
      inquilino_cpf: toStr(inq.cpf),
      inquilino_estado_civil: toStr(inq.estado_civil),
      inquilino_profissao: toStr(inq.profissao),
      inquilino_rg: toStr(inq.rg),
      inquilino_email: toStr(inq.email),
      inquilino_telefone: toStr(inq.telefone),
      inquilino_endereco: toStr(inq.endereco),
      valor_aluguel: toNum(loc.valor_aluguel),
      dia_vencimento: toInt(loc.dia_vencimento),
      data_contrato_original: toDate(loc.data_contrato_original),
      data_inicio_vigencia: dataInicioVig,
      prazo_meses: prazo,
      data_fim_vigencia: dataFimVig,
      indice_reajuste: toStr(loc.indice_reajuste) ?? "IGP-M",
      periodicidade_reajuste_meses: toInt(loc.periodicidade_reajuste_meses) ?? 12,
      mes_base_reajuste: toInt(loc.mes_base_reajuste),
      encargos_inquilino: {
        condominio: toBool(enc.condominio, true),
        agua: toBool(enc.agua, true),
        luz: toBool(enc.luz, true),
        iptu: toBool(enc.iptu, true),
        tcr: toBool(enc.tcr, true),
      },
      multa_mora_percent: toNum(loc.multa_mora_percent) ?? 2,
      juros_mora_mensal_percent: toNum(loc.juros_mora_mensal_percent) ?? 1,
      multa_rescisoria_multiplicador: toNum(loc.multa_rescisoria_multiplicador) ?? 3,
      multa_rescisoria_proporcional: toBool(loc.multa_rescisoria_proporcional, true),
      aviso_previo_dias: toInt(loc.aviso_previo_dias) ?? 30,
      foro: toStr(loc.foro),
      status: "ativo",
      arquivo_contrato_url: data.arquivoPath ?? null,
    };

    let contratoId: string;
    if (isRenovacao && contratoExistenteId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prev } = await (sb as any)
        .from("contratos_locacao")
        .select("historico_renovacoes, data_contrato_original, data_inicio_vigencia, prazo_meses, data_fim_vigencia")
        .eq("id", contratoExistenteId)
        .maybeSingle();
      const hist: unknown[] = Array.isArray(prev?.historico_renovacoes)
        ? prev.historico_renovacoes
        : [];
      hist.push({
        registrada_em: new Date().toISOString(),
        data_inicio_vigencia_anterior: prev?.data_inicio_vigencia ?? null,
        prazo_meses_anterior: prev?.prazo_meses ?? null,
        data_fim_vigencia_anterior: prev?.data_fim_vigencia ?? null,
        renovacao: {
          data_contrato_original: basePayload.data_contrato_original,
          data_inicio_vigencia: dataInicioVig,
          prazo_meses: prazo,
          data_fim_vigencia: dataFimVig,
        },
      });
      const updatePayload = {
        ...basePayload,
        // Preserva data_contrato_original se já havia
        data_contrato_original:
          prev?.data_contrato_original ?? basePayload.data_contrato_original,
        data_renovacao: dataInicioVig,
        historico_renovacoes: hist,
        status: "ativo",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eUp } = await (sb as any)
        .from("contratos_locacao")
        .update(updatePayload)
        .eq("id", contratoExistenteId);
      if (eUp) throw new Error(`Renovação: ${eUp.message}`);
      contratoId = contratoExistenteId;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contratoIns, error: eContrato } = await (sb as any)
        .from("contratos_locacao")
        .insert(basePayload)
        .select("id")
        .single();
      if (eContrato) throw new Error(`Contrato: ${eContrato.message}`);
      contratoId = contratoIns.id as string;
    }

    // 4) Caução
    const c = data.caucao as Record<string, unknown>;
    if (toBool(c.possui, false)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: eC } = await (sb as any).from("caucoes").upsert({
        owner_admin_id: owner,
        contrato_locacao_id: contratoId,
        possui: true,
        valor_depositado: toNum(c.valor_depositado),
        tipo: toStr(c.tipo),
        corrige_com_rendimento: toBool(c.corrige_com_rendimento, true),
        data_deposito: toDate(c.data_deposito),
      }, { onConflict: "contrato_locacao_id" });
      if (eC) throw new Error(`Caução: ${eC.message}`);
    }

    return {
      contrato_id: contratoId,
      proprietario_id: proprietarioId,
      imovel_id: imovelId,
      imovel_duplicado: imovelDuplicado,
      renovacao_aplicada: isRenovacao && !!data.contrato_existente_id,
    };
  });

/** Grava importação de contrato de administração (proprietário + contrato + imóveis administrados). */
export const salvarImportacaoAdministracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => salvarAdmInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const owner = context.userId;
    const sb = context.supabase;

    // 1) Proprietário
    let proprietarioId = data.proprietario_id ?? null;
    if (!proprietarioId) {
      const p = data.proprietario as Record<string, unknown>;
      const nome = toStr(p.nome);
      if (!nome) throw new Error("Nome do proprietário é obrigatório");
      const { data: ins, error } = await sb.from("proprietarios").insert({
        owner_admin_id: owner,
        nome,
        cpf: toStr(p.cpf),
        endereco: toStr(p.endereco),
        email: toStr(p.email),
        telefone: toStr(p.telefone),
      }).select("id").single();
      if (error) throw new Error(`Proprietário: ${error.message}`);
      proprietarioId = ins.id as string;
    }

    // 2) Contrato de administração
    const adm = data.administrador as Record<string, unknown>;
    const hon = data.honorarios as Record<string, unknown>;
    const vig = data.vigencia as Record<string, unknown>;
    const { data: contratoIns, error: eC } = await sb.from("contratos_administracao").insert({
      owner_admin_id: owner,
      proprietario_id: proprietarioId,
      administrador_nome: toStr(adm.nome),
      administrador_documento: toStr(adm.documento),
      administrador_oab: toStr(adm.oab),
      pix_recebimento: toStr(adm.pix),
      banco_recebimento: toStr(adm.banco),
      agencia_recebimento: toStr(adm.agencia),
      conta_recebimento: toStr(adm.conta),
      percent_honorario_renovacao: toNum(hon.percent_honorario_renovacao) ?? 50,
      percent_honorario_mensal: toNum(hon.percent_honorario_mensal) ?? 10,
      mora_multa_percent: toNum(hon.mora_multa_percent) ?? 2,
      mora_juros_mensal_percent: toNum(hon.mora_juros_mensal_percent) ?? 1,
      mora_indice: toStr(hon.mora_indice) ?? "IGP-M",
      data_inicio: toDate(vig.data_inicio),
      prazo_meses: toInt(vig.prazo_meses) ?? 24,
      status: "ativo",
      arquivo_contrato_url: data.arquivoPath ?? null,
    }).select("id").single();
    if (eC) throw new Error(`Contrato de administração: ${eC.message}`);

    // 3) Imóveis administrados — cria os que faltam, vincula (sem duplicar) os já existentes
    const criados: Array<{ id: string; label: string }> = [];
    const vinculados: Array<{ id: string; label: string }> = [];
    for (const raw of data.imoveis_administrados) {
      const im = raw as Record<string, unknown>;
      const dup = await buscarImovelDuplicado(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sb as any,
        proprietarioId!,
        im,
      );
      if (dup) {
        vinculados.push(dup);
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error: eImv } = await (sb as any).from("imoveis").insert({
        owner_admin_id: owner,
        proprietario_id: proprietarioId!,
        descricao: toStr(im.descricao),
        endereco: toStr(im.endereco),
        edificio: toStr(im.edificio),
        numero_unidade: toStr(im.numero_unidade),
      }).select("id, edificio, numero_unidade, endereco").single();
      if (eImv) throw new Error(`Imóveis administrados: ${eImv.message}`);
      const label = [ins.edificio, ins.numero_unidade].filter(Boolean).join(" ").trim()
        || String(ins.endereco ?? "");
      criados.push({ id: String(ins.id), label });
    }

    return {
      contrato_id: contratoIns.id as string,
      proprietario_id: proprietarioId,
      imoveis_criados: criados,
      imoveis_vinculados: vinculados,
    };
  });