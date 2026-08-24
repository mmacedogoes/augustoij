/**
 * Relatório de auditoria em PDF — anexo destinado a acompanhar a ata.
 * Não há assinatura digital com certificado: o documento carrega o resultado
 * da verificação de integridade, o hash da cadeia de votos e o hash do próprio
 * relatório, com a declaração do que cada um demonstra.
 */
import { carimbo } from "./auditoria-utils";

const MM = (mm: number) => (mm * 72) / 25.4;

export async function hashDoRelatorio(dados: unknown): Promise<string> {
  const texto = JSON.stringify(dados);
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function gerarPdfAuditoria(dados: any): Promise<Blob> {
  const [{ default: jsPDF }, reg, bold] = await Promise.all([
    import("jspdf"),
    import("@/assets/fonts/cormorant-regular"),
    import("@/assets/fonts/cormorant-bold"),
  ]);

  const hashRelatorio = await hashDoRelatorio(dados);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.addFileToVFS("CormorantGaramond-Regular.ttf", reg.cormorantRegular);
  doc.addFont("CormorantGaramond-Regular.ttf", "Cormorant", "normal");
  doc.addFileToVFS("CormorantGaramond-Bold.ttf", bold.cormorantBold);
  doc.addFont("CormorantGaramond-Bold.ttf", "Cormorant", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margem = MM(22);
  const util = pageW - margem * 2;
  let y = margem;

  const quebra = (altura = 18) => {
    if (y + altura > pageH - margem - 34) {
      doc.addPage();
      y = margem;
    }
  };

  const titulo = (texto: string, tamanho = 15) => {
    quebra(30);
    doc.setFont("Cormorant", "bold");
    doc.setFontSize(tamanho);
    doc.text(texto, margem, y);
    y += tamanho + 8;
  };

  const paragrafo = (texto: string, opts: { mono?: boolean; tamanho?: number } = {}) => {
    doc.setFont(opts.mono ? "courier" : "Cormorant", "normal");
    doc.setFontSize(opts.tamanho ?? (opts.mono ? 9 : 11));
    const linhas = doc.splitTextToSize(texto, util);
    for (const linha of linhas) {
      quebra();
      doc.text(linha, margem, y);
      y += (opts.tamanho ?? (opts.mono ? 9 : 11)) * 1.45;
    }
  };

  doc.setFont("Cormorant", "bold");
  doc.setFontSize(18);
  doc.text("RELATÓRIO DE AUDITORIA DE ASSEMBLEIA", pageW / 2, y, { align: "center" });
  y += 30;

  titulo("Identificação");
  paragrafo(`Condomínio: ${dados.condominio.nome}`);
  if (dados.condominio.cnpj) paragrafo(`CNPJ: ${dados.condominio.cnpj}`);
  if (dados.condominio.endereco) paragrafo(`Endereço: ${dados.condominio.endereco}`);
  if (dados.condominio.cidade) paragrafo(`Município: ${dados.condominio.cidade}`);
  paragrafo(`Assembleia: ${dados.assembleia.titulo} (${dados.assembleia.tipo})`);
  paragrafo(`Código público: ${dados.assembleia.codigo}`);
  paragrafo(`Data e hora: ${carimbo(dados.assembleia.dataHora)}`);
  paragrafo(`Local: ${dados.assembleia.local ?? "não informado"} · Modalidade: ${dados.assembleia.modalidade}`);

  titulo("Sessões");
  if (!dados.sessoes.length) paragrafo("Nenhuma sessão registrada.");
  for (const s of dados.sessoes) {
    paragrafo(
      `Sessão ${s.ordem}: início em ${carimbo(s.inicio)}${s.fim ? `, encerrada em ${carimbo(s.fim)}` : ""}` +
        `${s.local ? ` — ${s.local}` : ""} · ${s.total} presenças registradas.`,
    );
  }

  titulo("Habilitação");
  paragrafo(`Unidades aptas: ${dados.habilitacao.aptas} · Unidades inaptas: ${dados.habilitacao.inaptas}`);
  for (const b of dados.habilitacao.bloqueios) paragrafo(`Bloqueios por ${b.motivo}: ${b.total}`);
  paragrafo("Os bloqueios são apresentados por motivo, sem identificação nominal de unidades ou condôminos.");

  for (const item of dados.itens) {
    titulo(`Item ${item.ordem} — ${item.titulo}`, 13);
    paragrafo(item.frase);
    if (item.quorumExigido != null) {
      paragrafo(`Quórum exigido: ${item.quorumExigido} · Quórum atingido: ${item.quorumAtingido}`);
    }
    for (const t of item.totais) paragrafo(`${t.opcao}: ${t.total} voto(s)`);
    paragrafo(
      item.secreto
        ? "Recibos deste item, em ordem de recibo, sem identificação de unidade (item secreto):"
        : "Recibos deste item, com a respectiva opção, sem identificação de unidade:",
    );
    for (const r of item.recibos) paragrafo(`${r.recibo}   ${r.opcao}`, { mono: true });
  }

  titulo("Tentativas recusadas");
  if (!dados.tentativas.length) paragrafo("Nenhuma tentativa recusada registrada.");
  for (const t of dados.tentativas) paragrafo(`${t.motivo}: ${t.total}`);

  titulo("Integridade e verificação");
  paragrafo(
    dados.integridade.integra
      ? `Cadeia íntegra. Foram encadeados e verificados ${dados.integridade.totalVotos} votos.`
      : `Cadeia quebrada na sequência ${dados.integridade.sequenciaQuebrada} (registro ${dados.integridade.votoId}).`,
  );
  paragrafo(`Hash do relatório: ${hashRelatorio}`, { mono: true });
  if (dados.ata?.hash) paragrafo(`Hash da última publicação da ata: ${dados.ata.hash}`, { mono: true });
  paragrafo(
    "Declaração: a verificação de integridade recalcula o encadeamento de hashes voto a voto e demonstra que " +
      "nenhum registro foi alterado depois de gravado. O hash da ata identifica a versão publicada. O hash do " +
      "relatório identifica este arquivo. Este documento não possui assinatura digital com certificado.",
  );
  paragrafo(
    "Nenhum endereço IP completo, valor de débito, nome de inadimplente, voto individual de item secreto, " +
      "telefone, e-mail ou conteúdo de gravação consta deste relatório.",
  );

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("Cormorant", "normal");
    doc.setFontSize(8);
    doc.text(
      `Gerado em ${carimbo(dados.geradoEm)} por ${dados.geradoPor} · Integridade: ${
        dados.integridade.integra ? "íntegra" : "quebrada"
      }`,
      margem,
      pageH - MM(10),
    );
    doc.text(`${i} / ${total}`, pageW - margem, pageH - MM(10), { align: "right" });
  }

  return doc.output("blob");
}
