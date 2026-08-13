/**
 * Geração de documentos (PDF/DOCX) a partir das minutas redigidas pelo
 * Augusto no chat. Tudo roda no navegador — nenhum dado sai do dispositivo.
 *
 * Formatação padrão do escritório:
 *  - Título: CAIXA ALTA, Cormorant Garamond 14pt, negrito, centralizado.
 *  - Corpo: Cormorant Garamond 12pt, entrelinha 1,5, recuo de 2 cm na
 *    primeira linha, justificado.
 *  - A4, margens de 2,5 cm.
 */

export const DOC_MARKER_RE = /^\s*\[\[DOCUMENTO:\s*(.+?)\s*\]\]\s*$/gim;

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "item"; texto: string }
  | { tipo: "centro"; texto: string };

/** Remove marcações markdown inline que não fazem sentido no documento. */
function limparInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/`{1,3}/g, "")
    .replace(/^>\s?/, "")
    .trim();
}

const RE_ASSINATURA = /^(_{3,}|-{3,}\s*$|\s*_+\s*$)/;

/** Linhas de conversa/aviso que nunca podem entrar no arquivo gerado. */
const RE_LINHAS_REMOVIVEIS: RegExp[] = [
  /^\s*\[\[DOCUMENTO:[^\]]*\]\]\s*$/i,
  /deseja que eu gere o arquivo/i,
  /inteligência artificial/i,
  /não substitui o parecer/i,
  /processados conforme LGPD/i,
  /^\s*[*_>\s]*⚠️/,
  /^\s*(segue|segue abaixo|abaixo segue|elaborei|preparei|redigi|minutei)\b[^.]{0,120}[:.]?\s*$/i,
  /^\s*(se quiser|se desejar|caso queira|qualquer ajuste|fico à disposição|espero ter ajudado|posso (também )?(gerar|ajustar|adaptar))\b.*$/i,
  /^\s*.{0,120}\b(pdf|docx|word)\b.{0,120}\?\s*$/i,
];

/**
 * Remove do markdown as marcas de conversa e o disclaimer de IA antes de
 * transformar o texto em documento. Nunca corta no meio de um parágrafo:
 * só descarta linhas inteiras. Se a limpeza esvaziar o conteúdo, devolve
 * o texto original (o documento sempre sai).
 */
export function limparParaDocumento(markdown: string): string {
  const original = markdown ?? "";
  const limpo = original
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((linha) => {
      const l = linha.trim();
      if (!l) return true;
      return !RE_LINHAS_REMOVIVEIS.some((re) => re.test(l));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return limpo.length >= 40 ? limpo : original.trim();
}

/**
 * Converte o markdown simples produzido pelo modelo em blocos tipados.
 * O primeiro título (# / ## na primeira linha) é usado como título do
 * documento quando nenhum título explícito é informado.
 */
export function parseDocumento(markdown: string, tituloPadrao: string) {
  const linhas = limparParaDocumento(markdown).split("\n");
  const blocos: Bloco[] = [];
  let titulo = "";
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const texto = limparInline(buffer.join(" ").replace(/\s+/g, " "));
    if (texto) blocos.push({ tipo: "paragrafo", texto });
    buffer = [];
  };

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) {
      flush();
      continue;
    }
    if (/^\|.*\|$/.test(linha)) {
      // tabelas são raras em minutas — vira linha de texto simples
      flush();
      const celulas = linha
        .split("|")
        .slice(1, -1)
        .map((c) => limparInline(c))
        .filter(Boolean);
      if (celulas.length && !/^-{2,}$/.test(celulas[0])) {
        blocos.push({ tipo: "item", texto: celulas.join(" — ") });
      }
      continue;
    }
    const h = linha.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const texto = limparInline(h[2]);
      if (!titulo && (h[1].length <= 2 || blocos.length === 0)) {
        titulo = texto;
      } else {
        blocos.push({ tipo: "subtitulo", texto });
      }
      continue;
    }
    if (/^\*\*[^*]+\*\*[:.]?$/.test(linha)) {
      flush();
      blocos.push({ tipo: "subtitulo", texto: limparInline(linha) });
      continue;
    }
    if (RE_ASSINATURA.test(linha)) {
      flush();
      blocos.push({ tipo: "centro", texto: "________________________________________" });
      continue;
    }
    const li = linha.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      blocos.push({ tipo: "item", texto: limparInline(li[2]) });
      continue;
    }
    buffer.push(linha);
  }
  flush();

  const tituloFinal = (titulo || tituloPadrao || "DOCUMENTO").toUpperCase();
  return { titulo: tituloFinal, blocos };
}

export function nomeArquivo(titulo: string, ext: "pdf" | "docx"): string {
  const base =
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "documento";
  return `${base}.${ext}`;
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Valida o conteúdo antes de qualquer geração (estado "vazio"). */
export function validarConteudo(markdown: string): string | null {
  if (!markdown || !markdown.trim()) return "Não há conteúdo para gerar o arquivo.";
  if (markdown.trim().length < 40) return "O texto é curto demais para virar um documento.";
  if (markdown.length > 400_000) return "O documento é grande demais para ser gerado aqui.";
  return null;
}

// ---------------------------------------------------------------- PDF

const MM = (v: number) => v * 2.834645669; // mm -> pt

export async function gerarPdfBlob(
  markdown: string,
  tituloPadrao: string,
): Promise<{ blob: Blob; nome: string; titulo: string }> {
  const { titulo, blocos } = parseDocumento(markdown, tituloPadrao);
  const [{ default: jsPDF }, reg, bold] = await Promise.all([
    import("jspdf"),
    import("@/assets/fonts/cormorant-regular"),
    import("@/assets/fonts/cormorant-bold"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("CormorantGaramond-Regular.ttf", reg.cormorantRegular);
  doc.addFont("CormorantGaramond-Regular.ttf", "Cormorant", "normal");
  doc.addFileToVFS("CormorantGaramond-Bold.ttf", bold.cormorantBold);
  doc.addFont("CormorantGaramond-Bold.ttf", "Cormorant", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margem = MM(25);
  const larguraUtil = pageW - margem * 2;
  const recuo = MM(20); // 2 cm
  const lh12 = 12 * 1.5;
  const lh14 = 14 * 1.5;
  let y = margem;
  let subtituloIdx = 0;


  const novaPaginaSePreciso = (altura: number) => {
    if (y + altura > pageH - margem) {
      doc.addPage();
      y = margem;
    }
  };

  const escrever = (
    texto: string,
    opts: { size: number; bold?: boolean; align?: "left" | "center" | "justify"; indent?: number },
  ) => {
    doc.setFont("Cormorant", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    const lh = opts.size * 1.5;
    const indent = opts.indent ?? 0;

    if (opts.align !== "justify") {
      const linhas = doc.splitTextToSize(texto, larguraUtil - indent) as string[];
      linhas.forEach((linha, i) => {
        novaPaginaSePreciso(lh);
        if (opts.align === "center") {
          doc.text(linha, pageW / 2, y + opts.size, { align: "center" });
        } else {
          doc.text(linha, margem + (i === 0 ? indent : 0), y + opts.size);
        }
        y += lh;
      });
      return;
    }

    // Justificação manual: quebra por palavras respeitando o recuo da
    // primeira linha e distribui o espaço restante entre as palavras.
    const palavras = texto.split(/\s+/).filter(Boolean);
    const linhas: Array<{ palavras: string[]; indent: number }> = [];
    let atual: string[] = [];
    let primeira = true;
    const dispon = () => larguraUtil - (primeira ? indent : 0);
    for (const palavra of palavras) {
      const teste = atual.length ? `${atual.join(" ")} ${palavra}` : palavra;
      if (atual.length && doc.getTextWidth(teste) > dispon()) {
        linhas.push({ palavras: atual, indent: primeira ? indent : 0 });
        primeira = false;
        atual = [palavra];
      } else {
        atual = [...atual, palavra];
      }
    }
    if (atual.length) linhas.push({ palavras: atual, indent: primeira ? indent : 0 });

    linhas.forEach((linha, i) => {
      novaPaginaSePreciso(lh);
      const x0 = margem + linha.indent;
      const largura = larguraUtil - linha.indent;
      const ultima = i === linhas.length - 1;
      if (ultima || linha.palavras.length < 2) {
        doc.text(linha.palavras.join(" "), x0, y + opts.size);
      } else {
        const somaPalavras = linha.palavras.reduce((s, p) => s + doc.getTextWidth(p), 0);
        const espaco = (largura - somaPalavras) / (linha.palavras.length - 1);
        let x = x0;
        for (const p of linha.palavras) {
          doc.text(p, x, y + opts.size);
          x += doc.getTextWidth(p) + espaco;
        }
      }
      y += lh;
    });
  };

  escrever(titulo, { size: 14, bold: true, align: "center" });
  y += lh14 * 0.5;

  for (const b of blocos) {
    switch (b.tipo) {
      case "subtitulo": {
        subtituloIdx++;
        y += lh12 * 0.8;
        const num = `${subtituloIdx}. `;
        escrever(num + b.texto.toUpperCase(), { size: 12, bold: true });
        y += lh12 * 0.2;
        break;
      }
      case "item":
        escrever(`•  ${b.texto}`, { size: 12, indent: recuo / 2, align: "justify" });
        break;
      case "centro":
        y += lh12;
        escrever(b.texto, { size: 12, align: "center" });
        break;
      default:
        escrever(b.texto, { size: 12, align: "justify", indent: recuo });

    }
  }

  return { blob: doc.output("blob"), nome: nomeArquivo(titulo, "pdf"), titulo };
}

export async function gerarPdf(markdown: string, tituloPadrao: string): Promise<void> {
  const { blob, nome } = await gerarPdfBlob(markdown, tituloPadrao);
  baixarBlob(blob, nome);
}

// --------------------------------------------------------------- DOCX

export async function gerarDocxBlob(
  markdown: string,
  tituloPadrao: string,
): Promise<{ blob: Blob; nome: string; titulo: string }> {
  const { titulo, blocos } = parseDocumento(markdown, tituloPadrao);
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");

  const FONT = "Cormorant Garamond";
  const LINE = 360; // 1,5 (240 = simples)
  const INDENT = 1134; // 2 cm em DXA
  let subtituloIdx = 0;


  const paragrafos = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE, after: 360 },
      children: [new TextRun({ text: titulo, font: FONT, size: 28, bold: true })],
    }),
    ...blocos.map((b) => {
      if (b.tipo === "subtitulo") {
        subtituloIdx++;
        return new Paragraph({
          spacing: { line: LINE, before: 400, after: 200 },
          children: [
            new TextRun({ 
              text: `${subtituloIdx}. ${b.texto.toUpperCase()}`, 
              font: FONT, 
              size: 24, 
              bold: true 
            }),
          ],
        });
      }
      if (b.tipo === "item") {
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: LINE, after: 120 },
          indent: { left: INDENT / 2, hanging: 227 },
          children: [new TextRun({ text: `•  ${b.texto}`, font: FONT, size: 24 })],
        });
      }
      if (b.tipo === "centro") {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, before: 360, after: 360 },
          children: [new TextRun({ text: b.texto, font: FONT, size: 24 })],
        });
      }
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE, after: 120 },
        indent: { firstLine: INDENT },
        children: [new TextRun({ text: b.texto, font: FONT, size: 24 })],
      });
    }),

  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1418, right: 1418, bottom: 1418, left: 1418 },
          },
        },
        children: paragrafos,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return { blob, nome: nomeArquivo(titulo, "docx"), titulo };
}

export async function gerarDocx(markdown: string, tituloPadrao: string): Promise<void> {
  const { blob, nome } = await gerarDocxBlob(markdown, tituloPadrao);
  baixarBlob(blob, nome);
}