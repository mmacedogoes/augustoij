/**
 * PDF da ata — mesmo mecanismo já usado no projeto para documentos
 * (jsPDF + Cormorant Garamond embutida). Roda no navegador.
 */

const MM = (mm: number) => (mm * 72) / 25.4;

export type DadosPdfAta = {
  titulo: string;
  paragrafos: string[];
  presidente: string | null;
  secretario: string | null;
  rascunho: boolean;
};

export async function gerarPdfAta(dados: DadosPdfAta): Promise<Blob> {
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
  const util = pageW - margem * 2;
  let y = margem;

  const marcaDagua = () => {
    if (!dados.rascunho) return;
    doc.setFont("Cormorant", "bold");
    doc.setFontSize(52);
    doc.setTextColor(200, 200, 200);
    doc.text("MINUTA NÃO PUBLICADA", pageW / 2, pageH / 2, { align: "center", angle: 30 });
    doc.setTextColor(0, 0, 0);
  };

  const novaPagina = () => {
    doc.addPage();
    marcaDagua();
    y = margem;
  };

  marcaDagua();

  doc.setFont("Cormorant", "bold");
  doc.setFontSize(14);
  const tituloLinhas = doc.splitTextToSize(dados.titulo.toUpperCase(), util);
  for (const linha of tituloLinhas) {
    doc.text(linha, pageW / 2, y, { align: "center" });
    y += 14 * 1.5;
  }
  y += 12;

  doc.setFont("Cormorant", "normal");
  doc.setFontSize(12);
  for (const p of dados.paragrafos) {
    const linhas = doc.splitTextToSize(p, util - MM(20));
    for (let i = 0; i < linhas.length; i++) {
      if (y + 18 > pageH - margem - 40) novaPagina();
      doc.text(linhas[i], margem + (i === 0 ? MM(20) : 0), y, {
        maxWidth: util,
        align: i === linhas.length - 1 ? "left" : "justify",
      });
      y += 12 * 1.5;
    }
    y += 8;
  }

  // Assinaturas
  if (y + 120 > pageH - margem) novaPagina();
  y += 48;
  const assinatura = (nome: string | null, cargo: string, x: number) => {
    doc.line(x - 90, y, x + 90, y);
    doc.setFontSize(11);
    doc.text(nome || "____________________", x, y + 16, { align: "center" });
    doc.setFontSize(9);
    doc.text(cargo, x, y + 30, { align: "center" });
  };
  assinatura(dados.presidente, "Presidente da mesa", pageW / 4 + MM(10));
  assinatura(dados.secretario, "Secretário", (pageW * 3) / 4 - MM(10));

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("Cormorant", "normal");
    doc.setFontSize(9);
    doc.text(`${i} / ${total}`, pageW - margem, pageH - MM(12), { align: "right" });
  }

  return doc.output("blob");
}
