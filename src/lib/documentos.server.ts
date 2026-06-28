import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export async function extractText(buffer: Uint8Array, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  try {
    if (lower.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(buffer);
      const { text } = await unpdfExtract(pdf, { mergePages: true });
      const out = Array.isArray(text) ? text.join("\n\n") : text;
      if (!out || !out.trim()) {
        throw new Error(
          "PDF sem texto extraível. Pode ser um PDF escaneado (apenas imagens) — converta para texto com OCR antes de enviar.",
        );
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