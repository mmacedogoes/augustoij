import { describe, expect, it } from "vitest";
import {
  chaveUnidade,
  consolidar,
  montarLotes,
  normalizarParaCadastro,
  validarCoberturaExtracao,
} from "./unidades-extracao.server";

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

  it("não descarta trechos que não parecem relevantes isoladamente", () => {
    const lotes = montarLotes([
      { id: "1", conteudo: "601A", metadata: { bloco: 1, trecho: 1 } },
      { id: "2", conteudo: "315,50 m² — 1,9956%", metadata: { bloco: 1, trecho: 2 } },
    ]);
    expect(lotes.map((lote) => lote.texto).join("\n")).toContain("315,50 m²");
  });

  it("mapeia identificador composto nos dois sentidos para o cadastro", () => {
    const conhecidas = [{ bloco: "A", numero: "601" }];
    expect(normalizarParaCadastro({ numero: "601A" }, conhecidas)).toMatchObject({
      bloco: "A",
      numero: "601",
    });
    expect(normalizarParaCadastro({ numero: "A601" }, conhecidas)).toMatchObject({
      bloco: "A",
      numero: "601",
    });
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

  it("descarta a leitura vizinha quando outra citação liga unidade e valor", () => {
    const resultado = consolidar(
      [
        {
          bloco: "A",
          numero: "601",
          fracao_ideal: 1.9828,
          fracao_origem: "documento",
          fracao_trecho: "FRAÇÃO IDEAL 1,9828%",
        },
        {
          bloco: "A",
          numero: "601",
          fracao_ideal: 1.9956,
          fracao_origem: "documento",
          fracao_trecho: "A unidade 601A possui FRAÇÃO IDEAL 1,9956%",
        },
      ],
      [{ bloco: "A", numero: "601" }],
    );
    expect(resultado.conflitos).toEqual([]);
    expect(resultado.unidades[0]?.fracao_ideal).toBe(1.9956);
  });

  it("mantém bloqueio quando duas citações igualmente fortes divergem", () => {
    const resultado = consolidar(
      [
        {
          bloco: "A",
          numero: "601",
          area_m2: 315.5,
          area_origem: "documento",
          area_trecho: "Unidade 601A — ÁREA REAL PRIVATIVA 315,50 m²",
        },
        {
          bloco: "A",
          numero: "601",
          area_m2: 310.37,
          area_origem: "documento",
          area_trecho: "Unidade 601A — ÁREA REAL PRIVATIVA 310,37 m²",
        },
      ],
      [{ bloco: "A", numero: "601" }],
    );
    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.unidades[0]?.area_m2).toBeNull();
  });
});