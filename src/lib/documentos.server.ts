import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export async function extractText(buffer: Uint8Array, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(buffer);
    const { text } = await unpdfExtract(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : text;
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return new TextDecoder("utf-8").decode(buffer);
  }
  throw new Error("Formato de arquivo não suportado. Use PDF, DOCX ou TXT.");
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