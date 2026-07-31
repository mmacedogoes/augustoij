import { describe, expect, it } from "vitest";
import { limparParaDocumento, parseDocumento } from "./documento-export";

const CORPO = `# NOTIFICAÇÃO EXTRAJUDICIAL

Pelo presente instrumento, fica o condômino notificado da infração ao artigo 12 da convenção, praticada em 10/05/2026, às 22h30, consistente em ruído excessivo após o horário de silêncio.`;

describe("limparParaDocumento", () => {
  it("remove o marcador e o convite de download", () => {
    const t = `${CORPO}\n\n[[DOCUMENTO: NOTIFICAÇÃO EXTRAJUDICIAL]]\nDeseja que eu gere o arquivo deste documento?`;
    const out = limparParaDocumento(t);
    expect(out).not.toMatch(/DOCUMENTO:/);
    expect(out).not.toMatch(/Deseja que eu gere/i);
    expect(out).toMatch(/Pelo presente instrumento/);
  });

  it("remove o disclaimer de inteligência artificial", () => {
    const t = `${CORPO}\n\n*⚠️ Conteúdo informativo gerado por inteligência artificial que não substitui o parecer e análise de um advogado habilitado.*`;
    expect(limparParaDocumento(t)).not.toMatch(/inteligência artificial/i);
  });

  it("remove molduras conversacionais", () => {
    const t = `Segue abaixo a minuta:\n\n${CORPO}\n\nSe quiser, posso ajustar o texto.`;
    const out = limparParaDocumento(t);
    expect(out).not.toMatch(/Segue abaixo/i);
    expect(out).not.toMatch(/Se quiser/i);
  });

  it("não altera um texto já limpo", () => {
    expect(limparParaDocumento(CORPO)).toBe(CORPO.trim());
  });

  it("mantém o original quando a limpeza esvaziaria o conteúdo", () => {
    const t = "Deseja que eu gere o arquivo deste documento?";
    expect(limparParaDocumento(t)).toBe(t);
  });

  it("parseDocumento entrega blocos sem os trechos de conversa", () => {
    const { titulo, blocos } = parseDocumento(
      `${CORPO}\n\n[[DOCUMENTO: NOTIFICAÇÃO EXTRAJUDICIAL]]\nDeseja que eu gere o arquivo deste documento?`,
      "DOCUMENTO",
    );
    expect(titulo).toBe("NOTIFICAÇÃO EXTRAJUDICIAL");
    expect(blocos.map((b) => b.texto).join(" ")).not.toMatch(/Deseja que eu gere/i);
  });
});
