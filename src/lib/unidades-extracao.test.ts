import { describe, expect, it } from "vitest";
import { detectarEscalaFracoes, normalizarFracao, numeroBrasileiro } from "./fracao-normalizar";
import {
  chaveUnidade,
  consolidar,
  montarLotes,
  normalizarParaCadastro,
  trechoContemIdentidade,
  validarCoberturaExtracao,
  type UnidadeExtraida,
  type DiagnosticoExtracao,
} from "./unidades-extracao.server";
import type { RegistroUnidade } from "./extracao/segmentador";

type Medida = NonNullable<UnidadeExtraida["medidas"]>[number];
const medida = (
  campo: Medida["campo"],
  valor_bruto: string,
  escala: Medida["escala"],
  trecho: string,
): Medida => ({
  campo,
  valor_bruto,
  escala,
  trecho,
  pagina: 12,
  bloco: 2,
});
const unidade = (numero: string, medidas: Medida[], bloco: string | null = "A"): UnidadeExtraida => ({
  bloco,
  numero,
  medidas,
});

const registroMock = (
  numero: string,
  texto: string,
  escopo: string | null = null,
): RegistroUnidade => ({
  registro_id: `doc:1:0`,
  documento_id: "doc",
  pagina: 1,
  offset_inicio: 0,
  offset_fim: texto.length,
  escopo,
  numero,
  sufixo: null,
  padrao_ancora: "apartamento_de_n",
  ancora: `Apartamento ${numero}`,
  texto,
});

describe("normalização brasileira", () => {
  it.each([
    ["1,9956%", "percentual", 0.019956],
    ["0,019956", "decimal", 0.019956],
    ["19,956‰", "milesimo", 0.019956],
    ["83,33 milésimos", "milesimo", 0.08333],
    ["1/56", "fracao_ordinaria", 0.01785714],
  ] as const)("normaliza %s", (literal, escala, esperado) => {
    expect(normalizarFracao(literal, escala)).toBeCloseTo(esperado, 8);
  });

  it("preserva separador brasileiro de milhar", () => {
    expect(numeroBrasileiro("1.234,56")).toBe(1234.56);
  });

  it("decide a escala somente pelo somatório completo", () => {
    expect(detectarEscalaFracoes(Array(56).fill("1,785714%"))).toMatchObject({
      escala: "percentual",
    });
    expect(detectarEscalaFracoes(Array(56).fill("0,01785714"))).toMatchObject({
      escala: "decimal",
    });
  });
});

describe("extração NBR 12721", () => {
  it("não confunde áreas e frações de grandezas diferentes", () => {
    const trecho = "| 601A | 315,50 | 42,10 | 357,60 | 1,9956% | 2,1000% |";
    const resultado = consolidar(
      [
        unidade("601", [
          medida("area_privativa", "315,50", "m2", trecho),
          medida("area_comum", "42,10", "m2", trecho),
          medida("area_global", "357,60", "m2", trecho),
          medida("fracao_terreno", "1,9956%", "percentual", trecho),
          medida("coeficiente_rateio", "2,1000%", "percentual", trecho),
        ]),
      ],
      [{ bloco: "A", numero: "601" }],
    );
    expect(resultado.conflitos).toEqual([]);
    expect(resultado.unidades[0]).toMatchObject({
      area_m2: 315.5,
      fracao_ideal: 0.019956,
      confianca: "alta",
    });
  });

  it("a área é a privativa, nunca global menos comum", () => {
    const trecho = "Unidade 101: área comum 43,6055 m², área global 131,5055 m², fração 0,033395";
    const resultado = consolidar(
      [
        unidade(
          "101",
          [
            medida("area_comum", "43,6055", "m2", trecho),
            medida("area_global", "131,5055", "m2", trecho),
            medida("fracao_terreno", "0,033395", "decimal", trecho),
          ],
          null,
        ),
      ],
      [{ bloco: null, numero: "101" }],
    );
    expect(resultado.unidades[0]?.area_m2).toBeNull();
    expect(resultado.unidades[0]?.area_m2).not.toBe(87.9);
    expect(resultado.unidades[0]?.motivos).toContain("area_privativa_ausente");
  });

  it("medida com valor presente no registro é aceita", () => {
    const textoRegistro =
      "O Apartamento 101 possui área real privativa de 75,90 m2, área de uso comum de 43,6055 m2, área de garagem de 12,00 m2, perfazendo a área real total de 131,5055 m2, com fração ideal no terreno de 0,033395 e área equivalente de 36,0669 m2.";
    const u101 = unidade(
      "101",
      [
        medida("area_privativa", "75,90", "m2", ""),
        medida("area_comum", "43,6055", "m2", ""),
        medida("area_garagem", "12,00", "m2", ""),
        medida("area_global", "131,5055", "m2", ""),
        medida("fracao_terreno", "0,033395", "decimal", ""),
        medida("area_equivalente", "36,0669", "m2", ""),
      ],
      null,
    );
    const registros = [registroMock("101", textoRegistro)];
    const resultado = consolidar(
      [u101],
      [{ bloco: null, numero: "101" }],
      { porId: new Map() },
      registros,
    );

    expect(resultado.unidades[0]?.medidas).toHaveLength(6);
    expect(resultado.unidades[0]?.medidas_descartadas ?? []).toHaveLength(0);
    expect(resultado.unidades[0]?.area_m2).toBe(75.9);
    expect(resultado.unidades[0]?.fracao_ideal).toBeCloseTo(0.033395, 6);
  });

  it("medida sem proveniência nenhuma não é rejeitada", () => {
    const u101 = unidade(
      "101",
      [
        medida("area_privativa", "75,90", "m2", ""),
        medida("area_comum", "43,6055", "m2", ""),
        medida("area_garagem", "12,00", "m2", ""),
        medida("area_global", "131,5055", "m2", ""),
        medida("fracao_terreno", "0,033395", "decimal", ""),
        medida("area_equivalente", "36,0669", "m2", ""),
      ],
      null,
    );
    // Sem registro correspondente
    const resultado = consolidar(
      [u101],
      [{ bloco: null, numero: "101" }],
      { porId: new Map() },
      [],
    );

    expect(resultado.unidades[0]?.medidas).toHaveLength(6);
    expect(resultado.unidades[0]?.regras_aplicadas).toContain("sem_proveniencia");
    const valorNaoConfere = (resultado.unidades[0]?.medidas_descartadas ?? []).filter(
      (d) => d.motivo === "valor_nao_confere",
    );
    expect(valorNaoConfere).toHaveLength(0);
    expect(resultado.medidasDescartadas["valor_nao_confere"] ?? 0).toBe(0);
  });

  it("valor ausente do registro continua sendo rejeitado", () => {
    const textoRegistro =
      "O Apartamento 101 possui área real privativa de 75,90 m2 e área de uso comum de 43,6055 m2.";
    const u101 = unidade(
      "101",
      [medida("area_privativa", "999,99", "m2", "")],
      null,
    );
    const registros = [registroMock("101", textoRegistro)];
    const resultado = consolidar(
      [u101],
      [{ bloco: null, numero: "101" }],
      { porId: new Map() },
      registros,
    );

    expect(resultado.unidades[0]?.medidas).toHaveLength(0);
    expect(resultado.unidades[0]?.medidas_descartadas ?? []).toHaveLength(1);
    expect(resultado.unidades[0]?.medidas_descartadas?.[0]?.motivo).toBe("valor_nao_confere");
  });

  it("só conflita valores do mesmo campo além da tolerância", () => {
    const a = "Unidade 601A — área privativa 315,50 m²";
    const b = "Unidade 601A — área privativa 310,37 m²";
    const resultado = consolidar(
      [
        unidade("601", [medida("area_privativa", "315,50", "m2", a)]),
        unidade("601", [medida("area_privativa", "310,37", "m2", b)]),
      ],
      [{ bloco: "A", numero: "601" }],
    );
    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.unidades[0]?.confianca).toBe("conflito");
  });
});

describe("identidade, paginação e determinismo", () => {
  it.each([
    "601A",
    "601-A",
    "A-601",
    "601 do bloco A",
    "Bloco A, apartamento 601",
    "apto 601 — bloco A",
  ])("reconhece identificador composto %s", (texto) =>
    expect(trechoContemIdentidade({ bloco: "A", numero: "601" }, texto)).toBe(true),
  );

  it("mapeia identificador composto para o cadastro", () => {
    expect(
      normalizarParaCadastro({ numero: "601A", medidas: [] }, [{ bloco: "A", numero: "601" }]),
    ).toMatchObject({ bloco: "A", numero: "601" });
  });

  it("processa mais de mil chunks segundo ordem_global", () => {
    const chunks = Array.from({ length: 1_205 }, (_, i) => ({
      id: String(i),
      conteudo: `linha ${i}`,
      metadata: { bloco: Math.floor(i / 20), trecho: i % 20, ordem_global: i },
    })).reverse();
    const texto = montarLotes(chunks, 2_000)
      .map((l) => l.texto)
      .join("\n");
    expect(texto.indexOf("linha 0")).toBeLessThan(texto.indexOf("linha 1204"));
  });

  it("produz a mesma consolidação independentemente da ordem de chegada", () => {
    const linhas = Array.from({ length: 56 }, (_, i) => {
      const numero = String(101 + i);
      const trecho = `Unidade ${numero}A — área privativa 100,00 m² — fração ideal 1,785714%`;
      return unidade(numero, [
        medida("area_privativa", "100,00", "m2", trecho),
        medida("fracao_terreno", "1,785714%", "percentual", trecho),
      ]);
    });
    const conhecidas = linhas.map((u) => ({ bloco: u.bloco ?? null, numero: u.numero }));
    const a = consolidar(linhas, conhecidas);
    const b = consolidar([...linhas].reverse(), conhecidas);
    expect(b).toEqual(a);
    expect(a.unidades).toHaveLength(56);
    expect(a.somasHipoteses.percentual).toBeCloseTo(1, 5);
  });

  it("registra falhas aritméticas sem lançar exceção", () => {
    const diagnostico: DiagnosticoExtracao = { total_declarado_no_texto: 2, lotes_com_erro: 1 };
    const unidadeParcial = unidade("601", []);
    unidadeParcial.confianca = "media";
    const validacoes = validarCoberturaExtracao([unidadeParcial], diagnostico, null);
    expect(validacoes.some((v) => !v.ok)).toBe(true);
    expect(diagnostico.validacoes).toEqual(validacoes);
  });
});
