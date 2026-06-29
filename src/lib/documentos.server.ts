import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

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

/**
 * Lê e interpreta documentos escaneados ou imagens via Lovable AI Gateway
 * (modelo multimodal). Não usa OCR externo nem APIs de terceiros.
 */
export async function extractTextWithVision(
  apiKey: string,
  buffer: Uint8Array,
  fileName: string,
): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  const mime = mimeFor(fileName);
  const base64 = bufferToBase64(buffer);
  const dataUrl = `data:${mime};base64,${base64}`;

  const promptTxt =
    "Este documento é uma imagem escaneada ou um PDF sem camada de texto. " +
    "Faça OCR completo do conteúdo visível e devolva a transcrição fiel. " +
    "REGRAS DE TRANSCRIÇÃO:\n" +
    "1. Preserve a ordem de leitura, títulos, subtítulos e listas.\n" +
    "2. Transcreva TABELAS em Markdown (| coluna | coluna |\\n|---|---|\\n| valor | valor |), uma linha por linha do original, sem inventar colunas.\n" +
    "3. Mantenha numeração de artigos, parágrafos, incisos e cláusulas exatamente como aparecem.\n" +
    "4. Reproduza assinaturas, datas, números de processo e valores monetários sem reformatar.\n" +
    "5. Se houver carimbos ou anotações manuscritas legíveis, transcreva-as entre colchetes: [manuscrito: ...].\n" +
    "6. NÃO resuma, NÃO interprete, NÃO adicione comentários — devolva APENAS o texto extraído.";

  const isPdf = mime === "application/pdf";
  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: promptTxt }];
  if (isPdf) {
    userContent.push({
      type: "file",
      file: { filename: fileName, file_data: dataUrl },
    });
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
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Não foi possível interpretar o conteúdo do documento. Verifique se a imagem está legível e tente novamente.${
        body ? ` (gateway ${res.status})` : ""
      }`,
    );
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error(
      "Não foi possível interpretar o conteúdo do documento. Verifique se a imagem está legível e tente novamente.",
    );
  }
  return text;
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
    throw new Error(
      `Formato de arquivo não suportado: "${fileName}". Use PDF, DOCX ou TXT.`,
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