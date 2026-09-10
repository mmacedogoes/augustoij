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

export interface DocumentoCabecalho {
  nomeCondominio?: string;
  cnpj?: string;
  endereco?: string;
  cidadeUf?: string;
  protocolo?: string; // ex: "NOT-2026/042" ou "CIRC-2026/015"
}

export interface DocumentoAssinatura {
  nomeResponsavel?: string; // ex: "Administração Condominial" ou "Síndico(a) Profissional"
  cargoResponsavel?: string; // ex: "Síndico(a) / Administrador(a)"
  documentoResponsavel?: string; // ex: "CPF: 123.456.789-00" ou "OAB/SP 123.456"
  incluirSegundaAssinatura?: boolean;
  nomeSegundaAssinatura?: string; // ex: "Condômino(a) Notificado(a)"
  cargoSegundaAssinatura?: string; // ex: "Unidade 101"
  documentoSegundaAssinatura?: string;
  incluirTestemunhas?: boolean; // Se true, adiciona 2 campos para testemunhas
  cidadeData?: string; // ex: "São Paulo/SP, 10 de maio de 2026"
}

export interface DocumentoRodape {
  cidadeData?: string;
  textoLivre?: string;
  ocultarNumeracao?: boolean;
}

export interface DocumentoExportOptions {
  cabecalho?: DocumentoCabecalho;
  assinatura?: DocumentoAssinatura;
  rodape?: DocumentoRodape;
  tituloPersonalizado?: string;
}

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
export function parseDocumento(
  markdown: string,
  tituloPadrao: string,
  options?: DocumentoExportOptions,
) {
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

  const tituloFinal = (
    options?.tituloPersonalizado ||
    titulo ||
    tituloPadrao ||
    "DOCUMENTO"
  ).toUpperCase();
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
  options?: DocumentoExportOptions,
): Promise<{ blob: Blob; nome: string; titulo: string }> {
  const { titulo, blocos } = parseDocumento(markdown, tituloPadrao, options);
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
    if (y + altura > pageH - margem - MM(16)) {
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

  // 1. Cabeçalho Timbrado Institucional (se configurado)
  const cab = options?.cabecalho;
  if (cab?.nomeCondominio) {
    doc.setFont("Cormorant", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(cab.nomeCondominio.toUpperCase(), pageW / 2, y + 12, { align: "center" });
    y += 16;

    const subpartes: string[] = [];
    if (cab.cnpj) subpartes.push(`CNPJ: ${cab.cnpj}`);
    if (cab.endereco) subpartes.push(cab.endereco);
    if (cab.cidadeUf) subpartes.push(cab.cidadeUf);

    if (subpartes.length > 0) {
      doc.setFont("Cormorant", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(80, 80, 80);
      const subtexto = subpartes.join(" • ");
      const sublinhas = doc.splitTextToSize(subtexto, larguraUtil) as string[];
      for (const sl of sublinhas) {
        doc.text(sl, pageW / 2, y + 9, { align: "center" });
        y += 12;
      }
    }

    if (cab.protocolo) {
      doc.setFont("Cormorant", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Protocolo nº: ${cab.protocolo}`, pageW / 2, y + 9, { align: "center" });
      y += 12;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.75);
    doc.line(margem, y + 4, pageW - margem, y + 4);
    y += 20;
    doc.setTextColor(0, 0, 0);
  }

  // 2. Título da Peça Jurídica
  escrever(titulo, { size: 14, bold: true, align: "center" });
  y += lh14 * 0.5;

  // 3. Blocos de Conteúdo
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

  // 4. Fecho e Bloco de Assinaturas Parametrizadas
  const ass = options?.assinatura;
  if (
    ass &&
    (ass.cidadeData ||
      ass.nomeResponsavel ||
      ass.incluirSegundaAssinatura ||
      ass.incluirTestemunhas)
  ) {
    if (ass.cidadeData) {
      y += lh12;
      novaPaginaSePreciso(lh12 * 2);
      doc.setFont("Cormorant", "normal");
      doc.setFontSize(12);
      doc.text(ass.cidadeData, pageW - margem, y + 12, { align: "right" });
      y += lh12 * 1.5;
    }

    if (ass.incluirSegundaAssinatura) {
      novaPaginaSePreciso(lh12 * 6);
      y += lh12 * 1.5;
      const colLargura = (larguraUtil - MM(15)) / 2;
      const xCol1Center = margem + colLargura / 2;
      const xCol2Center = margem + colLargura + MM(15) + colLargura / 2;

      doc.setFont("Cormorant", "normal");
      doc.setFontSize(11);
      doc.text("___________________________________", xCol1Center, y + 11, { align: "center" });
      doc.text("___________________________________", xCol2Center, y + 11, { align: "center" });
      y += lh12;

      doc.setFont("Cormorant", "bold");
      doc.setFontSize(11);
      doc.text(
        ass.nomeResponsavel || "NOTIFICANTE / ADMINISTRAÇÃO",
        xCol1Center,
        y + 11,
        { align: "center" },
      );
      doc.text(
        ass.nomeSegundaAssinatura || "NOTIFICADO(A) / CONDÔMINO",
        xCol2Center,
        y + 11,
        { align: "center" },
      );
      y += 13;

      doc.setFont("Cormorant", "normal");
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      if (ass.cargoResponsavel) {
        doc.text(ass.cargoResponsavel, xCol1Center, y + 10, { align: "center" });
      }
      if (ass.cargoSegundaAssinatura) {
        doc.text(ass.cargoSegundaAssinatura, xCol2Center, y + 10, { align: "center" });
      }
      y += 12;

      if (ass.documentoResponsavel) {
        doc.text(ass.documentoResponsavel, xCol1Center, y + 10, { align: "center" });
      }
      if (ass.documentoSegundaAssinatura) {
        doc.text(ass.documentoSegundaAssinatura, xCol2Center, y + 10, { align: "center" });
      }
      y += 14;
      doc.setTextColor(0, 0, 0);
    } else if (ass.nomeResponsavel) {
      novaPaginaSePreciso(lh12 * 5);
      y += lh12 * 1.5;
      doc.setFont("Cormorant", "normal");
      doc.setFontSize(12);
      doc.text("____________________________________________", pageW / 2, y + 12, { align: "center" });
      y += lh12;

      doc.setFont("Cormorant", "bold");
      doc.setFontSize(12);
      doc.text(ass.nomeResponsavel, pageW / 2, y + 12, { align: "center" });
      y += 14;

      doc.setFont("Cormorant", "normal");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      if (ass.cargoResponsavel) {
        doc.text(ass.cargoResponsavel, pageW / 2, y + 11, { align: "center" });
        y += 13;
      }
      if (ass.documentoResponsavel) {
        doc.text(ass.documentoResponsavel, pageW / 2, y + 11, { align: "center" });
        y += 13;
      }
      doc.setTextColor(0, 0, 0);
    }

    if (ass.incluirTestemunhas) {
      novaPaginaSePreciso(lh12 * 6);
      y += lh12 * 1.5;
      doc.setFont("Cormorant", "bold");
      doc.setFontSize(11);
      doc.text("TESTEMUNHAS:", margem, y + 11);
      y += lh12 * 1.8;

      const colLargura = (larguraUtil - MM(15)) / 2;
      const x1 = margem;
      const x2 = margem + colLargura + MM(15);

      doc.setFont("Cormorant", "normal");
      doc.setFontSize(10.5);
      doc.text("1. _________________________________", x1, y + 10);
      doc.text("2. _________________________________", x2, y + 10);
      y += 14;
      doc.text("   Nome:                                ", x1, y + 10);
      doc.text("   Nome:                                ", x2, y + 10);
      y += 13;
      doc.text("   CPF:                                 ", x1, y + 10);
      doc.text("   CPF:                                 ", x2, y + 10);
      y += 16;
    }
  }

  // 5. Numeração de Páginas e Rodapé do PDF
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(margem, pageH - MM(14), pageW - margem, pageH - MM(14));

    doc.setFont("Cormorant", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);

    const textoEsq = options?.cabecalho?.nomeCondominio || options?.rodape?.textoLivre || "";
    if (textoEsq) {
      const limpoEsq = textoEsq.length > 55 ? textoEsq.slice(0, 52) + "…" : textoEsq;
      doc.text(limpoEsq, margem, pageH - MM(8));
    }

    if (!options?.rodape?.ocultarNumeracao) {
      doc.text(`Página ${i} de ${totalPaginas}`, pageW - margem, pageH - MM(8), {
        align: "right",
      });
    }
  }
  doc.setTextColor(0, 0, 0);

  return { blob: doc.output("blob"), nome: nomeArquivo(titulo, "pdf"), titulo };
}

export async function gerarPdf(
  markdown: string,
  tituloPadrao: string,
  options?: DocumentoExportOptions,
): Promise<void> {
  const { blob, nome } = await gerarPdfBlob(markdown, tituloPadrao, options);
  baixarBlob(blob, nome);
}

// --------------------------------------------------------------- DOCX

export async function gerarDocxBlob(
  markdown: string,
  tituloPadrao: string,
  options?: DocumentoExportOptions,
): Promise<{ blob: Blob; nome: string; titulo: string }> {
  const { titulo, blocos } = parseDocumento(markdown, tituloPadrao, options);
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Footer,
    PageNumber,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = await import("docx");

  const FONT = "Cormorant Garamond";
  const LINE = 360; // 1,5 (240 = simples)
  const INDENT = 1134; // 2 cm em DXA
  let subtituloIdx = 0;

  const paragrafos: (import("docx").Paragraph | import("docx").Table)[] = [];

  // 1. Cabeçalho Timbrado no DOCX (se configurado)
  const cab = options?.cabecalho;
  if (cab?.nomeCondominio) {
    paragrafos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE, after: 60 },
        children: [
          new TextRun({
            text: cab.nomeCondominio.toUpperCase(),
            font: FONT,
            size: 26,
            bold: true,
          }),
        ],
      }),
    );

    const subpartes: string[] = [];
    if (cab.cnpj) subpartes.push(`CNPJ: ${cab.cnpj}`);
    if (cab.endereco) subpartes.push(cab.endereco);
    if (cab.cidadeUf) subpartes.push(cab.cidadeUf);

    if (subpartes.length > 0) {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 60 },
          children: [
            new TextRun({
              text: subpartes.join(" • "),
              font: FONT,
              size: 19,
              color: "555555",
            }),
          ],
        }),
      );
    }

    if (cab.protocolo) {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 120 },
          children: [
            new TextRun({
              text: `Protocolo nº: ${cab.protocolo}`,
              font: FONT,
              size: 19,
              italics: true,
              color: "666666",
            }),
          ],
        }),
      );
    }

    paragrafos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE, after: 360 },
        children: [
          new TextRun({
            text: "____________________________________________________________",
            font: FONT,
            size: 20,
            color: "CCCCCC",
          }),
        ],
      }),
    );
  }

  // 2. Título da Peça
  paragrafos.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE, after: 360 },
      children: [new TextRun({ text: titulo, font: FONT, size: 28, bold: true })],
    }),
  );

  // 3. Blocos de Conteúdo
  for (const b of blocos) {
    if (b.tipo === "subtitulo") {
      subtituloIdx++;
      paragrafos.push(
        new Paragraph({
          spacing: { line: LINE, before: 400, after: 200 },
          children: [
            new TextRun({
              text: `${subtituloIdx}. ${b.texto.toUpperCase()}`,
              font: FONT,
              size: 24,
              bold: true,
            }),
          ],
        }),
      );
    } else if (b.tipo === "item") {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: LINE, after: 120 },
          indent: { left: INDENT / 2, hanging: 227 },
          children: [new TextRun({ text: `•  ${b.texto}`, font: FONT, size: 24 })],
        }),
      );
    } else if (b.tipo === "centro") {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, before: 360, after: 360 },
          children: [new TextRun({ text: b.texto, font: FONT, size: 24 })],
        }),
      );
    } else {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: LINE, after: 120 },
          indent: { firstLine: INDENT },
          children: [new TextRun({ text: b.texto, font: FONT, size: 24 })],
        }),
      );
    }
  }

  // 4. Fecho e Assinaturas Parametrizadas no DOCX
  const ass = options?.assinatura;
  if (
    ass &&
    (ass.cidadeData ||
      ass.nomeResponsavel ||
      ass.incluirSegundaAssinatura ||
      ass.incluirTestemunhas)
  ) {
    if (ass.cidadeData) {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { line: LINE, before: 240, after: 240 },
          children: [new TextRun({ text: ass.cidadeData, font: FONT, size: 24 })],
        }),
      );
    }

    if (ass.incluirSegundaAssinatura) {
      const semBordas = {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      };

      const celulaCol1: import("docx").Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 60 },
          children: [new TextRun({ text: "____________________________________", font: FONT, size: 22 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 40 },
          children: [
            new TextRun({
              text: ass.nomeResponsavel || "NOTIFICANTE / ADMINISTRAÇÃO",
              font: FONT,
              size: 22,
              bold: true,
            }),
          ],
        }),
      ];
      if (ass.cargoResponsavel) {
        celulaCol1.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: 20 },
            children: [new TextRun({ text: ass.cargoResponsavel, font: FONT, size: 20, color: "555555" })],
          }),
        );
      }
      if (ass.documentoResponsavel) {
        celulaCol1.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE },
            children: [new TextRun({ text: ass.documentoResponsavel, font: FONT, size: 20, color: "555555" })],
          }),
        );
      }

      const celulaCol2: import("docx").Paragraph[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 60 },
          children: [new TextRun({ text: "____________________________________", font: FONT, size: 22 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 40 },
          children: [
            new TextRun({
              text: ass.nomeSegundaAssinatura || "NOTIFICADO(A) / CONDÔMINO",
              font: FONT,
              size: 22,
              bold: true,
            }),
          ],
        }),
      ];
      if (ass.cargoSegundaAssinatura) {
        celulaCol2.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: 20 },
            children: [new TextRun({ text: ass.cargoSegundaAssinatura, font: FONT, size: 20, color: "555555" })],
          }),
        );
      }
      if (ass.documentoSegundaAssinatura) {
        celulaCol2.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE },
            children: [new TextRun({ text: ass.documentoSegundaAssinatura, font: FONT, size: 20, color: "555555" })],
          }),
        );
      }

      paragrafos.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: semBordas,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: celulaCol1,
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: celulaCol2,
                }),
              ],
            }),
          ],
        }),
      );
    } else if (ass.nomeResponsavel) {
      paragrafos.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, before: 360, after: 60 },
          children: [
            new TextRun({
              text: "____________________________________________",
              font: FONT,
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { line: LINE, after: 40 },
          children: [
            new TextRun({
              text: ass.nomeResponsavel,
              font: FONT,
              size: 24,
              bold: true,
            }),
          ],
        }),
      );
      if (ass.cargoResponsavel) {
        paragrafos.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: 20 },
            children: [new TextRun({ text: ass.cargoResponsavel, font: FONT, size: 22, color: "555555" })],
          }),
        );
      }
      if (ass.documentoResponsavel) {
        paragrafos.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: 120 },
            children: [new TextRun({ text: ass.documentoResponsavel, font: FONT, size: 20, color: "555555" })],
          }),
        );
      }
    }

    if (ass.incluirTestemunhas) {
      paragrafos.push(
        new Paragraph({
          spacing: { line: LINE, before: 300, after: 120 },
          children: [new TextRun({ text: "TESTEMUNHAS:", font: FONT, size: 22, bold: true })],
        }),
      );

      const semBordas = {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      };

      paragrafos.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: semBordas,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      spacing: { line: LINE, after: 40 },
                      children: [new TextRun({ text: "1. _________________________________", font: FONT, size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { line: LINE, after: 20 },
                      children: [new TextRun({ text: "   Nome:", font: FONT, size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { line: LINE, after: 20 },
                      children: [new TextRun({ text: "   CPF:", font: FONT, size: 20 })],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      spacing: { line: LINE, after: 40 },
                      children: [new TextRun({ text: "2. _________________________________", font: FONT, size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { line: LINE, after: 20 },
                      children: [new TextRun({ text: "   Nome:", font: FONT, size: 20 })],
                    }),
                    new Paragraph({
                      spacing: { line: LINE, after: 20 },
                      children: [new TextRun({ text: "   CPF:", font: FONT, size: 20 })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      );
    }
  }

  const rodapeTextoEsq =
    options?.cabecalho?.nomeCondominio || options?.rodape?.textoLivre || "";

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
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  ...(rodapeTextoEsq
                    ? [
                        new TextRun({
                          text: `${rodapeTextoEsq}     |     `,
                          font: FONT,
                          size: 18,
                          color: "888888",
                        }),
                      ]
                    : []),
                  ...(options?.rodape?.ocultarNumeracao
                    ? []
                    : [
                        new TextRun({
                          text: "Página ",
                          font: FONT,
                          size: 18,
                          color: "888888",
                        }),
                        PageNumber.CURRENT,
                        new TextRun({
                          text: " de ",
                          font: FONT,
                          size: 18,
                          color: "888888",
                        }),
                        PageNumber.TOTAL_PAGES,
                      ]),
                ],
              }),
            ],
          }),
        },
        children: paragrafos,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return { blob, nome: nomeArquivo(titulo, "docx"), titulo };
}

export async function gerarDocx(
  markdown: string,
  tituloPadrao: string,
  options?: DocumentoExportOptions,
): Promise<void> {
  const { blob, nome } = await gerarDocxBlob(markdown, tituloPadrao, options);
  baixarBlob(blob, nome);
}