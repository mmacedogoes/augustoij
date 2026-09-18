import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
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
import { segmentarRegistros, type RegistroUnidade } from "./extracao/segmentador";
import { interpretarConvencaoDescritiva } from "./convencao-descritiva";
import { lerRegistro } from "./extracao/rotulos";
import { extrairUnidadesDoTexto } from "./extracao/pipeline";


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

describe("Regressão Teste 3 — Loteamento 761 lotes e matriz de redações", () => {
  const fixturePath = path.resolve(__dirname, "extracao/fixtures/loteamento-761.txt");
  const textoLoteamento = fs.readFileSync(fixturePath, "utf-8");

  it("a) a frase normativa não vira unidade", () => {
    const paginas = [{ numero: 1, texto: textoLoteamento }];
    const registros = segmentarRegistros(paginas, "doc-761");
    expect(registros.length).toBe(761);

    const descritiva = interpretarConvencaoDescritiva(textoLoteamento, registros.length);
    expect(descritiva.ok).toBe(false);
    expect(descritiva.tentativa.motivo_descarte).toBe("cobertura_insuficiente");
  });

  it("b) o loteamento é lido por registro", () => {
    const paginas = [{ numero: 1, texto: textoLoteamento }];
    const registros = segmentarRegistros(paginas, "doc-761");
    expect(registros.length).toBe(761);

    const candidatas: UnidadeExtraida[] = [];
    for (const reg of registros) {
      const medidasLidas = lerRegistro(reg.texto);
      const medidas: Medida[] = [];
      for (const med of medidasLidas) {
        let campo: Medida["campo"] = "indeterminado";
        if (med.campo === "area_privativa") campo = "area_privativa";
        else if (med.campo === "area_terreno") campo = "area_terreno";
        else if (med.campo === "fracao_ideal") campo = "fracao_terreno";
        medidas.push({
          campo,
          valor_bruto: med.valor_bruto,
          escala: med.escala as any,
          trecho: med.trecho,
        });
      }
      candidatas.push({
        bloco: reg.escopo,
        numero: reg.numero,
        tipo: "lote",
        medidas,
      });
    }

    const censo = { porId: new Map(registros.map((r) => [r.registro_id, { pagina: r.pagina, texto: r.texto }])) };
    const consolidado = consolidar(candidatas, [], censo, registros, "casas_lotes");

    expect(consolidado.unidades.length).toBe(761);

    // lote 03
    const lote03Quadra01 = consolidado.unidades.find((u) => u.bloco === "QUADRA 01" && u.numero === "03");
    expect(lote03Quadra01).toBeDefined();
    expect(lote03Quadra01?.area_m2).toBe(250.00);
    expect(lote03Quadra01?.fracao_ideal).toBeCloseTo(0.001314, 6);
  });

  it("c) lote 01 da quadra 03 e lote 01 da quadra 12 são unidades distintas", () => {
    const paginas = [{ numero: 1, texto: textoLoteamento }];
    const registros = segmentarRegistros(paginas, "doc-761");

    const regQ03 = registros.find((r) => r.escopo === "QUADRA 03" && r.numero === "01");
    const regQ12 = registros.find((r) => r.escopo === "QUADRA 12" && r.numero === "01");
    expect(regQ03).toBeDefined();
    expect(regQ12).toBeDefined();
    expect(regQ03?.registro_id).not.toBe(regQ12?.registro_id);

    const ch03 = chaveUnidade(regQ03!.escopo, regQ03!.numero);
    const ch12 = chaveUnidade(regQ12!.escopo, regQ12!.numero);
    expect(ch03).not.toBe(ch12);
  });

  it("d) matriz de redações lê as oito redações do Defeito 3", () => {
    const redacoes = [
      "área de terreno de 250,00 m2",
      "área do terreno de 250,00 m2",
      "área do lote de 250,00 m2",
      "com área de 250,00 m2",
      "área privativa de terreno de 250,00 m2",
      "área total do lote de 250,00 m2",
      "área de solo de 250,00 m2",
      "medindo 250,00 m2 de área",
    ];

    for (const r of redacoes) {
      const res = lerRegistro(r);
      expect(res.length).toBeGreaterThan(0);
      expect(res[0].valor_numerico).toBe(250.00);
    }
  });

  it("e) Teste 2 (32 apartamentos) continua passando", () => {
    const andares = [1, 2, 3, 4, 5, 6, 7, 8];
    const colunas = [1, 2, 3, 4];
    const fraseColunas1e3 =
      "com área privativa de 75,90 m2, área de uso comum de 24,10 m2, perfazendo a área total de 100,00 m2 e fração ideal de 0,033395.";
    const fraseColunas2e4 =
      "com área privativa de 62,50 m2, área de uso comum de 18,50 m2, perfazendo a área total de 81,00 m2 e fração ideal de 0,029105.";

    const linhas = ["CONVENÇÃO DE CONDOMÍNIO - EDIFÍCIO TESTE 32", "QUADRO DESCRITIVO DAS UNIDADES AUTÔNOMAS:"];
    for (const andar of andares) {
      for (const col of colunas) {
        const num = `${andar}0${col}`;
        const fraseMedida = col === 1 || col === 3 ? fraseColunas1e3 : fraseColunas2e4;
        linhas.push(`APARTAMENTO Nº ${num} - localizado no ${andar}º pavimento, ${fraseMedida}`);
      }
    }
    const texto32 = linhas.join("\n\n");
    const resultado = extrairUnidadesDoTexto(texto32);

    expect(resultado.total).toBe(32);
    const apto101 = resultado.unidades.find((u) => u.numero === "101");
    expect(apto101).toBeDefined();
    expect(apto101?.area_privativa).toBe(75.90);
    expect(apto101?.fracao_ideal).toBeCloseTo(0.033395, 6);
  });

});
