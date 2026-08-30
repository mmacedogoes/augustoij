import { describe, expect, it } from "vitest";
import { chaveUnidade, montarLotes, validarCoberturaExtracao } from "./unidades-extracao.server";

describe("extração literal de unidades", () => {
  it("normaliza bloco e número sem confundir acentos ou pontuação", () => {
    expect(chaveUnidade(" Torre Á ", "6.01")).toBe("torrea|601");
  });

  it("processa todos os trechos relevantes sem limite silencioso", () => {
    const chunks = Array.from({ length: 700 }, (_, i) => ({
      id: String(i).padStart(4, "0"),
      conteudo: `Unidade ${i + 1}: FRAÇÃO IDEAL 1,0000% e ÁREA REAL PRIVATIVA 100,00 m²`,
      metadata: { bloco: Math.floor(i / 10), trecho: i % 10 },
    }));
    const lotes = montarLotes(chunks, 2_000);
    expect(lotes.map((lote) => lote.texto).join("\n")).toContain("Unidade 700");
    expect(lotes.length).toBeGreaterThan(8);
  });

  it("recusa importação quando algum valor não tem proveniência documental", () => {
    expect(() =>
      validarCoberturaExtracao(
        [
          {
            bloco: "A",
            numero: "601",
            fracao_ideal: 1.9956,
            fracao_origem: "ausente",
            area_m2: 315.5,
            area_origem: "documento",
          },
        ],
        {},
        1,
      ),
    ).toThrow(/sem fração ideal comprovada/i);
  });

  it("aceita cobertura integral com área e fração documentadas", () => {
    expect(() =>
      validarCoberturaExtracao(
        [
          {
            bloco: "A",
            numero: "601",
            fracao_ideal: 1.9956,
            fracao_origem: "documento",
            area_m2: 315.5,
            area_origem: "documento",
          },
        ],
        { total_declarado_no_texto: 1, lotes_com_erro: 0 },
        1,
      ),
    ).not.toThrow();
  });
});