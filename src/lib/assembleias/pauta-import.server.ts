/**
 * Extração dos itens de pauta a partir de um edital em PDF (ou TXT/DOCX).
 * Texto extraído localmente e, em PDF escaneado, enviado como arquivo à IA.
 */
const MODEL = "google/gemini-2.5-flash";
const AIG_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 10 * 1024 * 1024;

export type ItemPautaExtraido = {
  titulo: string;
  descricao: string | null;
  tipo_votacao: "sim_nao_abstencao" | "escolha_unica";
  regra_quorum: string;
  base_calculo: string;
};

const QUORUNS = [
  "maioria_presentes",
  "maioria_absoluta",
  "dois_tercos",
  "tres_quartos",
  "unanimidade",
] as const;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1]! : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function extrairTextoDoPdf(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : (text ?? "")).trim();
}

async function extrairTextoDoDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return (value ?? "").trim();
  } catch {
    return "";
  }
}

function parseJsonLoose(raw: string): unknown {
  const s = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(s);
  } catch {
    /* noop */
  }
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch {
      /* noop */
    }
  }
  throw new Error("A IA não devolveu um resultado legível. Tente novamente.");
}

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro especialista em condomínios edilícios.
Receberá o texto de um EDITAL DE CONVOCAÇÃO de assembleia. Extraia APENAS os itens da ORDEM DO DIA (pauta),
na ordem em que aparecem, e devolva SOMENTE um JSON válido, sem markdown.

REGRAS:
- Ignore cabeçalho, local, data, horário, assinaturas e avisos gerais: só os itens deliberativos.
- "titulo": enunciado objetivo do item, até 160 caracteres, sem numeração romana ou arábica no início.
- "descricao": detalhamento quando existir no edital, até 400 caracteres; caso contrário null.
- "tipo_votacao": "escolha_unica" quando o item envolve eleição/escolha entre alternativas (ex.: eleição de síndico, escolha de proposta); caso contrário "sim_nao_abstencao".
- "regra_quorum": ${QUORUNS.join(" | ")}. Use "dois_tercos" para alteração de convenção, "unanimidade" para mudança de destinação da edificação, "tres_quartos" para obras voluptuárias, "maioria_absoluta" para obras úteis e, no restante, "maioria_presentes".
- Nunca invente itens que não estejam no texto.

FORMATO:
{ "itens": [ { "titulo": string, "descricao": string|null, "tipo_votacao": "sim_nao_abstencao"|"escolha_unica", "regra_quorum": string } ] }`;

type IaUserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "file"; file: { filename: string; file_data: string } }
    >;

async function chamarIa(apiKey: string, userContent: IaUserContent): Promise<string> {
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
        { role: "system", content: SYSTEM_PROMPT },
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
    throw new Error(`Falha na leitura do edital (${res.status}): ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function sanitizar(raw: unknown, basePadrao: string): ItemPautaExtraido[] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lista = Array.isArray(r.itens) ? r.itens : Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: ItemPautaExtraido[] = [];
  for (const it of lista) {
    const o = (it ?? {}) as Record<string, unknown>;
    const titulo = String(o.titulo ?? "").trim().replace(/^([IVXLCDM]+|\d+)[).\-–\s]+/i, "").trim();
    if (titulo.length < 3) continue;
    const desc = o.descricao === null || o.descricao === undefined ? null : String(o.descricao).trim() || null;
    const tipo = o.tipo_votacao === "escolha_unica" ? "escolha_unica" : "sim_nao_abstencao";
    const q = String(o.regra_quorum ?? "").trim().toLowerCase();
    out.push({
      titulo: titulo.slice(0, 160),
      descricao: desc ? desc.slice(0, 400) : null,
      tipo_votacao: tipo,
      regra_quorum: (QUORUNS as readonly string[]).includes(q) ? q : "maioria_presentes",
      base_calculo: basePadrao,
    });
    if (out.length >= 40) break;
  }
  return out;
}

export async function extrairItensPautaDeArquivo(input: {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  basePadrao?: string;
}): Promise<{ itens: ItemPautaExtraido[] }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A leitura por IA não está configurada neste ambiente.");

  const mime = input.mimeType.toLowerCase();
  const lower = input.fileName.toLowerCase();
  const isPdf = mime === "application/pdf" || lower.endsWith(".pdf");
  const isDocx = mime.includes("wordprocessingml") || lower.endsWith(".docx");
  const isTxt = mime.startsWith("text/") || lower.endsWith(".txt");
  if (!isPdf && !isDocx && !isTxt) throw new Error("Formato não suportado. Envie o edital em PDF.");

  const bytes = base64ToBytes(input.fileBase64);
  if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Arquivo grande demais (máx. 10 MB).");

  let texto = "";
  if (isPdf) texto = await extrairTextoDoPdf(bytes);
  else if (isDocx) texto = await extrairTextoDoDocx(bytes);
  else texto = new TextDecoder().decode(bytes).trim();

  let content: string;
  if (texto.length >= 200) {
    content = await chamarIa(apiKey, `EDITAL:\n\n${texto.slice(0, 120_000)}`);
  } else if (isPdf) {
    content = await chamarIa(apiKey, [
      { type: "text", text: "Extraia a ordem do dia deste edital em PDF." },
      {
        type: "file",
        file: {
          filename: input.fileName,
          file_data: `data:application/pdf;base64,${input.fileBase64.includes(",") ? input.fileBase64.split(",", 2)[1] : input.fileBase64}`,
        },
      },
    ]);
  } else {
    throw new Error("Não foi possível ler o conteúdo do arquivo.");
  }

  return { itens: sanitizar(parseJsonLoose(content), input.basePadrao ?? "voto_por_unidade") };
}
