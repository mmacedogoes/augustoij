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
const PAGINAS_POR_BLOCO = 6;
/** Chamadas simultâneas ao gateway. */
const CONCORRENCIA_OCR = 1;

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

export type BlocoOcr = { indice: number; inicio: number; fim: number; bytes: Uint8Array };

/** Paralelismo padrão e tipo MIME, expostos para a leitura retomável. */
export const OCR_CONCORRENCIA = CONCORRENCIA_OCR;
export function mimeParaArquivo(fileName: string): string {
  return mimeFor(fileName);
}

export type PlanoOcr = {
  mime: string;
  totalPaginas: number;
  blocos: Array<{ indice: number; inicio: number; fim: number }>;
  /** Gera os bytes do bloco sob demanda (evita manter o PDF inteiro fatiado na memória). */
  gerarBloco: (indice: number) => Promise<Uint8Array>;
};

/**
 * Planeja os blocos de OCR de um arquivo SEM materializar todos os sub-PDFs.
 * Cada bloco só é gerado quando for enviado ao OCR — manter todos em memória
 * estourava o limite do runtime em documentos grandes ("internal server error").
 */
export async function prepararPlanoOcr(buffer: Uint8Array, fileName: string): Promise<PlanoOcr> {
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  const mime = mimeFor(fileName);
  if (mime !== "application/pdf") {
    return {
      mime,
      totalPaginas: 1,
      blocos: [{ indice: 0, inicio: 1, fim: 1 }],
      gerarBloco: async () => buffer,
    };
  }

  const { PDFDocument } = await import("pdf-lib");
  let src: import("pdf-lib").PDFDocument;
  let total = 0;
  try {
    const copia = new Uint8Array(buffer.byteLength);
    copia.set(buffer);
    src = await PDFDocument.load(copia, { ignoreEncryption: true });
    total = src.getPageCount();
  } catch {
    // PDF atípico que não pode ser aberto: um único bloco com o arquivo inteiro.
    return {
      mime,
      totalPaginas: 0,
      blocos: [{ indice: 0, inicio: 1, fim: 0 }],
      gerarBloco: async () => buffer,
    };
  }

  const blocos: Array<{ indice: number; inicio: number; fim: number }> = [];
  for (let i = 0; i < total; i += PAGINAS_POR_BLOCO) {
    const fim = Math.min(i + PAGINAS_POR_BLOCO, total);
    blocos.push({ indice: blocos.length, inicio: i + 1, fim });
  }

  return {
    mime,
    totalPaginas: total,
    blocos,
    gerarBloco: async (indice: number) => {
      const b = blocos[indice];
      if (!b) throw new Error("Bloco inexistente.");
      const out = await PDFDocument.create();
      const paginas = await out.copyPages(
        src,
        Array.from({ length: b.fim - b.inicio + 1 }, (_, k) => b.inicio - 1 + k),
      );
      for (const p of paginas) out.addPage(p);
      return await out.save();
    },
  };
}


/** OCR de um bloco isolado (com uma retentativa em falhas transitórias). */
export async function ocrBloco(
  apiKey: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array,
): Promise<string> {
  return ocrComRetry(apiKey, fileName, mime, bytes);
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

  let plano: PlanoOcr;
  try {
    plano = await prepararPlanoOcr(buffer, fileName);
  } catch {
    // Não conseguiu abrir (PDF atípico): tenta o arquivo inteiro de uma vez.
    const texto = await ocrComRetry(apiKey, fileName, mime, buffer);
    if (!texto) {
      throw new Error(
        "Não foi possível interpretar o conteúdo do documento. Reenvie um PDF com melhor qualidade de digitalização.",
      );
    }
    return { texto, totalPaginas: 0, paginasLidas: 0, paginasFalhas: [] };
  }

  const total = plano.totalPaginas;
  const blocos = plano.blocos;
  const partes: string[] = new Array(blocos.length).fill("");
  const falhas: number[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= blocos.length) return;
      const bloco = blocos[idx];
      try {
        // Gera o sub-PDF só na hora do envio, para não guardar todos na memória.
        const bytes = await plano.gerarBloco(bloco.indice);
        const txt = await ocrComRetry(
          apiKey,
          `${fileName} (p. ${bloco.inicio}-${bloco.fim})`,
          mime,
          bytes,
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
  const { validarUploadSeguro } = await import("@/lib/seguranca-lgpd.server");
  const validacao = validarUploadSeguro(buffer, fileName);
  if (!validacao.valido) {
    throw new Error(validacao.motivo ?? "Arquivo inválido ou potencialmente inseguro.");
  }

  const lower = validacao.nomeSanitizado.toLowerCase();
  if (buffer.byteLength === 0) {
    throw new Error("Arquivo vazio (0 bytes). Reenvie um arquivo válido.");
  }
  if (isImageFile(validacao.nomeSanitizado)) {
    // imagens não têm camada de texto — sinaliza para o caller usar visão
    throw new Error("__NEEDS_VISION__");
  }
  try {
    if (lower.endsWith(".pdf")) {
      let paginasTexto: string[] = [];
      let totalPages = 1;
      let unpdfOk = false;

      try {
        const { extractText: unpdfExtract, getDocumentProxy } = await import("unpdf");
        const pdfCopy = new Uint8Array(buffer.byteLength);
        pdfCopy.set(buffer);
        const pdf = await getDocumentProxy(pdfCopy);
        const res = await unpdfExtract(pdf, { mergePages: false });
        totalPages = res.totalPages ?? 1;
        const rawText = res.text;
        paginasTexto = (Array.isArray(rawText) ? rawText : [rawText ?? ""]).map((p) => String(p ?? ""));
        unpdfOk = true;
      } catch (unpdfErr) {
        console.warn(
          "[documentos.server] Falha no extrator direto unpdf (acionando fallback para Visão/OCR multimodal):",
          unpdfErr instanceof Error ? unpdfErr.message : String(unpdfErr),
        );
        throw new Error("__NEEDS_VISION__");
      }

      if (unpdfOk) {
        const out = paginasTexto.join("\n\n");
        const limpo = out.trim();
        const paginas = Math.max(1, totalPages ?? paginasTexto.length ?? 1);
        const palavras = (p: string) => (p.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).length;
        const paginasComTexto = paginasTexto.filter((p) => palavras(p) >= 40).length;
        const vocabulario = /condom[ií]nio|artigo|fra[cç][aã]o|unidade/i.test(limpo);
        const suficiente =
          limpo.length > 0 && vocabulario && paginasComTexto >= Math.ceil(paginas * 0.6);
        if (!suficiente) {
          throw new Error("__NEEDS_VISION__");
        }
        return out;
      }
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
        throw new Error("Não foi possível ler a planilha. Salve como CSV e reenvie.");
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
      if (m === "__NEEDS_VISION__") throw e;
      if (/password|encrypted/i.test(m)) {
        throw new Error("PDF protegido por senha. Remova a proteção antes de enviar.");
      }
      if (lower.endsWith(".pdf")) {
        console.warn("[documentos.server] Falha inesperada no PDF, direcionando para OCR Visão:", m);
        throw new Error("__NEEDS_VISION__");
      }
      if (/Invalid PDF|InvalidPDFException|stream must have|corrupt/i.test(m)) {
        throw new Error("Arquivo corrompido ou inválido. Reenvie o documento original.");
      }
      throw e;
    }
    if (lower.endsWith(".pdf")) {
      throw new Error("__NEEDS_VISION__");
    }
    throw new Error("Falha na leitura do conteúdo do arquivo.");
  }
}

/**
 * Expressões regulares para detecção de divisões hierárquicas e dispositivos legais:
 */
const REGEX_TITULO_HIERARQUICO =
  /^\s*(?:(?:CAP[IÍ]TULO|T[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O|LIVRO|PARTE)\s+[0-9IVXLCDM]+.*|DISPOSI[CÇ][OÕ]ES\s+(?:GERAIS|FINAIS|TRANSIT[OÓ]RIAS|PRELIMINARES).*|REGIMENTO\s+INTERNO.*|CONVEN[CÇ][AÃ]O.*)\s*$/i;

const REGEX_INICIO_ARTIGO =
  /^\s*(?:Art(?:igo|\.)?\s*[\d]+[ºªa-z\d\.\-]*|Cl[aá]usula\s*[\d]+[ºªa-z\d\.\-]*|Item\s*[\d]+[ºªa-z\d\.\-]*)\s*[-–—:.]?/i;

/**
 * Divide artigos excepcionalmente longos preservando parágrafos e incisos atômicos.
 */
function chunkArtigoLongo(breadcrumb: string, linhas: string[], maxSize: number): string[] {
  const chunks: string[] = [];
  let blocoAtual: string[] = [];

  for (const linha of linhas) {
    if (blocoAtual.length > 0 && blocoAtual.join("\n").length + linha.length + 1 > maxSize) {
      const cabecalho = breadcrumb ? `${breadcrumb}\n` : "";
      chunks.push(`${cabecalho}${blocoAtual.join("\n")}`.trim());
      blocoAtual = [];
    }
    blocoAtual.push(linha);
  }

  if (blocoAtual.length > 0) {
    const cabecalho = breadcrumb ? `${breadcrumb}\n` : "";
    chunks.push(`${cabecalho}${blocoAtual.join("\n")}`.trim());
  }

  return chunks;
}

/**
 * Divide documentos jurídicos e condominiais (Convenções, Regimentos, Contratos)
 * preservando a integridade de cada Artigo/Cláusula e seus parágrafos/incisos/tabelas.
 */
export function chunkDocumentoJuridicoSemantico(
  text: string,
  maxSize = 1800,
  overlap = 200,
): string[] {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (clean.length <= maxSize) return clean ? [clean] : [];

  const linhas = clean.split("\n");
  const unidades: Array<{ breadcrumb: string; linhas: string[] }> = [];

  let capituloAtual = "";
  let unidadeAtual: { breadcrumb: string; linhas: string[] } | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;

    // Detecta mudança de Capítulo / Título / Seção
    if (REGEX_TITULO_HIERARQUICO.test(linha)) {
      if (unidadeAtual && unidadeAtual.linhas.length > 0) {
        unidades.push(unidadeAtual);
        unidadeAtual = null;
      }
      capituloAtual = linha.replace(/^[#*_\s]+|[#*_\s]+$/g, "").trim();
      continue;
    }

    // Detecta início de um novo Artigo / Cláusula
    if (REGEX_INICIO_ARTIGO.test(linha)) {
      if (unidadeAtual && unidadeAtual.linhas.length > 0) {
        unidades.push(unidadeAtual);
      }
      const matchArtigo = linha.match(REGEX_INICIO_ARTIGO);
      const rotuloArtigo = matchArtigo ? matchArtigo[0].trim() : "";
      const breadcrumb = capituloAtual
        ? `[${capituloAtual} > ${rotuloArtigo}]`
        : `[${rotuloArtigo}]`;

      unidadeAtual = {
        breadcrumb,
        linhas: [linha],
      };
      continue;
    }

    // Linhas normais, parágrafos, incisos ou tabelas
    if (unidadeAtual) {
      unidadeAtual.linhas.push(linhas[i]);
    } else {
      unidadeAtual = {
        breadcrumb: capituloAtual ? `[${capituloAtual}]` : "",
        linhas: [linhas[i]],
      };
    }
  }

  if (unidadeAtual && unidadeAtual.linhas.length > 0) {
    unidades.push(unidadeAtual);
  }

  // Agrupa unidades normativas até o tamanho máximo sem quebrar artigos
  const chunks: string[] = [];
  let bufferLinhas: string[] = [];
  let bufferBreadcrumb = "";

  const flush = () => {
    if (bufferLinhas.length === 0) return;
    const conteudo = bufferLinhas.join("\n").trim();
    if (conteudo) {
      const cabecalho = bufferBreadcrumb ? `${bufferBreadcrumb}\n` : "";
      chunks.push(`${cabecalho}${conteudo}`.trim());
    }
    bufferLinhas = [];
    bufferBreadcrumb = "";
  };

  for (const u of unidades) {
    const textoUnidade = u.linhas.join("\n");

    // Caso a unidade inteira seja maior que maxSize (artigo gigante com dezenas de incisos)
    if (textoUnidade.length > maxSize) {
      flush();
      const subChunks = chunkArtigoLongo(u.breadcrumb, u.linhas, maxSize);
      chunks.push(...subChunks);
      continue;
    }

    // Se adicionar esta unidade ultrapassar maxSize, faz o flush do buffer atual
    const tamanhoProjetado =
      (bufferLinhas.length ? bufferLinhas.join("\n").length + 1 : 0) + textoUnidade.length;
    if (bufferLinhas.length > 0 && tamanhoProjetado > maxSize) {
      flush();
    }

    if (bufferLinhas.length === 0) {
      bufferBreadcrumb = u.breadcrumb;
    }
    bufferLinhas.push(textoUnidade);
  }

  flush();
  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Fatia o texto preservando quebras de linha e aplicando chunking semântico para
 * documentos jurídicos (Convenções, Regimentos e Contratos).
 */
export function chunkText(text: string, size = 1800, overlap = 200): string[] {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= size) return clean ? [clean] : [];

  // Se o documento contiver artigos, cláusulas ou divisões hierárquicas normativas,
  // utiliza o parser semântico jurídico para preservar os dispositivos legais intactos.
  const ehDocumentoNormativo =
    /(?:artigo|art\.)\s*\d+|cl[aá]usula\s*\d+|cap[ií]tulo\s+[0-9ivxlcdm]+/i.test(clean);

  if (ehDocumentoNormativo) {
    return chunkDocumentoJuridicoSemantico(clean, size, overlap);
  }

  const linhas = clean.split("\n");
  const chunks: string[] = [];
  let atuais: string[] = [];
  let cabecalhoTabela: string[] = [];
  const ehTabela = (linha: string) => /^\s*\|.*\|\s*$/.test(linha);
  const ehSeparador = (linha: string) => /^\s*\|?\s*:?-{3,}/.test(linha);
  const tamanho = (itens: string[]) => itens.join("\n").length;

  for (let indice = 0; indice < linhas.length; indice++) {
    const linha = linhas[indice];
    if (ehTabela(linha) && ehSeparador(linhas[indice + 1] ?? "")) {
      cabecalhoTabela = [linha, linhas[indice + 1]];
    }
    const prefixo =
      ehTabela(linha) && cabecalhoTabela.length > 0 && atuais.length === 0 ? cabecalhoTabela : [];
    if (atuais.length > 0 && tamanho([...atuais, linha]) > size) {
      chunks.push(atuais.join("\n").trim());
      const anteriores: string[] = [];
      let acumulado = 0;
      for (let i = atuais.length - 1; i >= 0 && acumulado < overlap; i--) {
        anteriores.unshift(atuais[i]);
        acumulado += atuais[i].length + 1;
      }
      atuais = ehTabela(linha)
        ? [...cabecalhoTabela, ...anteriores.filter((item) => !cabecalhoTabela.includes(item))]
        : anteriores;
    }
    if (atuais.length === 0 && prefixo.length) atuais.push(...prefixo);
    if (!atuais.includes(linha) || !cabecalhoTabela.includes(linha)) atuais.push(linha);
    if (!ehTabela(linha) && linha.trim()) cabecalhoTabela = [];
  }
  if (atuais.length) chunks.push(atuais.join("\n").trim());
  return chunks;
}

