import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXT.test(fileName);
}

export function isPdfFile(fileName: string): boolean {
  return /\.pdf$/i.test(fileName);
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const sub = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  // btoa is available in Workers and modern Node
  return btoa(binary);
}

function mimeFor(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  return IMAGE_MIME[ext] ?? "application/octet-stream";
}

const PROMPT_OCR =
  "Este documento é uma imagem escaneada / fotocópia ou um PDF sem camada de texto. " +
  "Faça OCR completo do conteúdo visível e devolva a transcrição fiel de TODAS as páginas recebidas. " +
  "REGRAS DE TRANSCRIÇÃO:\n" +
  "1. Preserve a ordem de leitura, títulos, subtítulos e listas.\n" +
  "2. Transcreva TABELAS em Markdown (| coluna | coluna |\\n|---|---|\\n| valor | valor |), uma linha por linha do original, sem inventar colunas nem valores.\n" +
  "3. Quadros de frações ideais, áreas e coeficientes são CRÍTICOS: transcreva todas as linhas, com os números exatamente como impressos.\n" +
  "4. Mantenha numeração de artigos, parágrafos, incisos e cláusulas exatamente como aparecem.\n" +
  "5. Reproduza assinaturas, datas, números de processo e valores monetários sem reformatar.\n" +
  "6. Se houver carimbos ou anotações manuscritas legíveis, transcreva-as entre colchetes: [manuscrito: ...].\n" +
  "7. Onde um caractere estiver ilegível, escreva [ilegível] no lugar — nunca adivinhe números.\n" +
  "8. NÃO resuma, NÃO interprete, NÃO adicione comentários — devolva APENAS o texto extraído.";

const OCR_MODEL = "google/gemini-3.7-flash";
/** Páginas por bloco de OCR (documentos longos são lidos em partes). */
const PAGINAS_POR_BLOCO = 4;
/** Chamadas simultâneas ao gateway. */
const CONCORRENCIA_OCR = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ocrGateway(
  apiKey: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  const dataUrl = `data:${mime};base64,${bufferToBase64(bytes)}`;
  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: PROMPT_OCR }];
  if (mime === "application/pdf") {
    userContent.push({ type: "file", file: { filename: fileName, file_data: dataUrl } });
  } else {
    userContent.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OCR falhou (gateway ${res.status}) ${body.slice(0, 200)}`);
    // 429/5xx são transitórios — o chamador tenta de novo.
    (err as Error & { retryavel?: boolean }).retryavel = res.status === 429 || res.status >= 500;
    throw err;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function ocrComRetry(
  apiKey: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  try {
    return await ocrGateway(apiKey, fileName, mime, bytes);
  } catch (e) {
    const retryavel = (e as Error & { retryavel?: boolean }).retryavel !== false;
    if (!retryavel) throw e;
    await sleep(2500);
    return await ocrGateway(apiKey, fileName, mime, bytes);
  }
}

export type ResultadoVisao = {
  texto: string;
  totalPaginas: number;
  paginasLidas: number;
  paginasFalhas: number[];
};

/** Divide o PDF em sub-PDFs de N páginas (JS puro, sem renderização). */
async function fatiarPdf(buffer: Uint8Array, porBloco: number) {
  const { PDFDocument } = await import("pdf-lib");
  const copia = new Uint8Array(buffer.byteLength);
  copia.set(buffer);
  const src = await PDFDocument.load(copia, { ignoreEncryption: true });
  const total = src.getPageCount();
  const blocos: { inicio: number; fim: number; bytes: Uint8Array }[] = [];
  for (let i = 0; i < total; i += porBloco) {
    const fim = Math.min(i + porBloco, total);
    const out = await PDFDocument.create();
    const paginas = await out.copyPages(
      src,
      Array.from({ length: fim - i }, (_, k) => i + k),
    );
    for (const p of paginas) out.addPage(p);
    blocos.push({ inicio: i + 1, fim, bytes: await out.save() });
  }
  return { total, blocos };
}

/**
 * Lê e interpreta documentos escaneados ou imagens via Lovable AI Gateway
 * (modelo multimodal). PDFs longos são lidos em blocos de páginas e as
 * transcrições são reconstruídas na ordem original; blocos ilegíveis viram
 * lacunas em vez de invalidar o documento inteiro.
 */
export async function extractTextWithVisionDetalhado(
  apiKey: string,
  buffer: Uint8Array,
  fileName: string,
): Promise<ResultadoVisao> {
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  const mime = mimeFor(fileName);

  if (mime !== "application/pdf") {
    const texto = await ocrComRetry(apiKey, fileName, mime, buffer);
    if (!texto) {
      throw new Error(
        "Não foi possível interpretar o conteúdo do documento. Verifique se a imagem está legível e tente novamente.",
      );
    }
    return { texto, totalPaginas: 1, paginasLidas: 1, paginasFalhas: [] };
  }

  let total = 0;
  let blocos: { inicio: number; fim: number; bytes: Uint8Array }[] = [];
  try {
    const r = await fatiarPdf(buffer, PAGINAS_POR_BLOCO);
    total = r.total;
    blocos = r.blocos;
  } catch (e) {
    // Não conseguiu fatiar (PDF atípico): tenta o arquivo inteiro de uma vez.
    const texto = await ocrComRetry(apiKey, fileName, mime, buffer);
    if (!texto) {
      throw new Error(
        "Não foi possível interpretar o conteúdo do documento. Reenvie um PDF com melhor qualidade de digitalização.",
      );
    }
    return { texto, totalPaginas: 0, paginasLidas: 0, paginasFalhas: [] };
  }

  const partes: string[] = new Array(blocos.length).fill("");
  const falhas: number[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= blocos.length) return;
      const bloco = blocos[idx];
      try {
        const txt = await ocrComRetry(
          apiKey,
          `${fileName} (p. ${bloco.inicio}-${bloco.fim})`,
          mime,
          bloco.bytes,
        );
        if (txt.trim()) partes[idx] = txt.trim();
        else for (let p = bloco.inicio; p <= bloco.fim; p++) falhas.push(p);
      } catch (err) {
        console.warn(`[ocr] bloco ${bloco.inicio}-${bloco.fim} falhou`, err);
        for (let p = bloco.inicio; p <= bloco.fim; p++) falhas.push(p);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA_OCR, blocos.length) }, () => worker()),
  );

  const texto = partes
    .map((p, i) => (p ? `\n\n<!-- páginas ${blocos[i].inicio}-${blocos[i].fim} -->\n${p}` : ""))
    .join("")
    .trim();

  if (!texto) {
    throw new Error(
      "Não foi possível ler nenhuma página deste documento. A digitalização está ilegível — reenvie uma cópia com melhor qualidade.",
    );
  }

  falhas.sort((a, b) => a - b);
  return {
    texto,
    totalPaginas: total,
    paginasLidas: total - falhas.length,
    paginasFalhas: falhas,
  };
}

/** Compat: devolve apenas o texto. */
export async function extractTextWithVision(
  apiKey: string,
  buffer: Uint8Array,
  fileName: string,
): Promise<string> {
  return (await extractTextWithVisionDetalhado(apiKey, buffer, fileName)).texto;
}


export async function extractText(buffer: Uint8Array, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  if (isImageFile(fileName)) {
    // imagens não têm camada de texto — sinaliza para o caller usar visão
    throw new Error("__NEEDS_VISION__");
  }
  try {
    if (lower.endsWith(".pdf")) {
      // IMPORTANTE: pdfjs/unpdf TRANSFERE o ArrayBuffer subjacente
      // (detach), o que zera `buffer.byteLength` após esta chamada.
      // Passamos uma cópia para preservar o buffer original do caller,
      // que ainda pode precisar dele para o fallback de visão/OCR.
      const pdfCopy = new Uint8Array(buffer.byteLength);
      pdfCopy.set(buffer);
      const pdf = await getDocumentProxy(pdfCopy);
      const { text } = await unpdfExtract(pdf, { mergePages: true });
      const out = Array.isArray(text) ? text.join("\n\n") : text;
      if (!out || !out.trim()) {
        throw new Error("__NEEDS_VISION__");
      }
      return out;
    }
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      if (!result.value || !result.value.trim()) {
        throw new Error("DOCX sem texto extraível ou corrompido.");
      }
      return result.value;
    }
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      const txt = new TextDecoder("utf-8").decode(buffer);
      if (!txt.trim()) throw new Error("Arquivo de texto vazio.");
      return txt;
    }
    if (lower.endsWith(".csv")) {
      const txt = new TextDecoder("utf-8").decode(buffer);
      if (!txt.trim()) throw new Error("CSV vazio.");
      return txt;
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(buffer, { type: "array" });
      } catch {
        throw new Error(
          "Não foi possível ler a planilha. Salve como CSV e reenvie.",
        );
      }
      const partes: string[] = [];
      for (const name of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        if (csv.trim()) partes.push(`## Aba: ${name}\n\n${csv}`);
      }
      const out = partes.join("\n\n");
      if (!out.trim()) throw new Error("Planilha sem dados legíveis.");
      return out;
    }
    throw new Error(
      `Formato de arquivo não suportado: "${fileName}". Use PDF, DOCX, DOC, TXT, CSV, XLS ou XLSX.`,
    );
  } catch (e) {
    if (e instanceof Error) {
      const m = e.message || "";
      if (/Invalid PDF|InvalidPDFException|stream must have|corrupt/i.test(m)) {
        throw new Error("Arquivo PDF corrompido ou inválido. Reenvie o documento original.");
      }
      if (/password|encrypted/i.test(m)) {
        throw new Error("PDF protegido por senha. Remova a proteção antes de enviar.");
      }
      throw e;
    }
    throw new Error("Falha na leitura do conteúdo do arquivo.");
  }
}

export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - overlap;
  }
  return chunks;
}