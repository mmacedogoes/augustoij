import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { detectarEscalaFracoes, normalizarFracao, numeroBrasileiro } from "./fracao-normalizar";
import {
  chaveUnidade,
  consolidar,
  montarLotes,
  normalizarParaCadastro,
  trechoContemIdentidade,
  validarCoberturaExtracao,
  processarExtracaoRodada,
  ErroTimeoutIA,
  ErroTruncadoIA,
  dividirTextoAoMeio,
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
    const lote03Quadra01 = consolidado.unidades.find(
      (u) => (u.bloco === "01" || u.bloco === "QUADRA 01") && u.numero === "03",
    );
    expect(lote03Quadra01).toBeDefined();
    expect(lote03Quadra01?.area_m2).toBe(250.00);
    expect(lote03Quadra01?.fracao_ideal).toBeCloseTo(0.001314, 6);
  });

  it("c) lote 01 da quadra 03 e lote 01 da quadra 12 são unidades distintas", () => {
    const paginas = [{ numero: 1, texto: textoLoteamento }];
    const registros = segmentarRegistros(paginas, "doc-761");

    const regQ03 = registros.find((r) => (r.escopo === "03" || r.escopo === "QUADRA 03") && r.numero === "01");
    const regQ12 = registros.find((r) => (r.escopo === "12" || r.escopo === "QUADRA 12") && r.numero === "01");
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

function createMockSupabase(initial: {
  doc?: any;
  condominio?: any;
  job?: any;
  chunks?: any[];
  storageMd?: string;
}) {
  let currentJob = initial.job ? JSON.parse(JSON.stringify(initial.job)) : null;
  const db: Record<string, any[]> = {
    documentos: initial.doc ? [initial.doc] : [],
    condominios: initial.condominio ? [initial.condominio] : [],
    unidades: [],
    extracao_jobs: currentJob ? [currentJob] : [],
    extracao_cache: [],
    document_chunks: initial.chunks ?? [],
    sugestoes_unidades: [],
    extracao_diagnosticos: [],
    extracao_ledger: [],
  };

  const client: any = {
    from: (table: string) => {
      const filters: Record<string, any> = {};
      let updates: any = null;
      let rangeStart = 0;
      let rangeEnd = 99999;

      const chain: any = {
        select: () => chain,
        order: () => chain,
        range: (start: number, end: number) => {
          rangeStart = start;
          rangeEnd = end;
          return chain;
        },
        eq: (col: string, val: any) => {
          filters[col] = val;
          return chain;
        },
        in: () => chain,
        maybeSingle: async () => {
          const rows = db[table] || [];
          const found = rows.find((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v),
          );
          return { data: found ? JSON.parse(JSON.stringify(found)) : null, error: null };
        },
        single: async () => {
          const rows = db[table] || [];
          const found = rows.find((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v),
          );
          if (!found) return { data: null, error: { message: "Not found" } };
          return { data: JSON.parse(JSON.stringify(found)), error: null };
        },
        then: (resolve: any) => {
          const rows = db[table] || [];
          const filtered = rows.filter((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v),
          );
          return Promise.resolve({
            data: JSON.parse(JSON.stringify(filtered.slice(rangeStart, rangeEnd + 1))),
            error: null,
          }).then(resolve);
        },
        update: (values: any) => {
          updates = values;
          return {
            eq: async (col: string, val: any) => {
              const rows = db[table] || [];
              for (const row of rows) {
                if (row[col] === val) {
                  Object.assign(row, JSON.parse(JSON.stringify(updates)));
                  if (table === "extracao_jobs") {
                    currentJob = JSON.parse(JSON.stringify(row));
                  }
                }
              }
              return { data: null, error: null };
            },
          };
        },
        upsert: async (values: any) => {
          const rows = db[table] || [];
          const docId = values.documento_id ?? values.id;
          const idx = rows.findIndex((r) => (r.documento_id ?? r.id) === docId);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...JSON.parse(JSON.stringify(values)) };
            if (table === "extracao_jobs") currentJob = JSON.parse(JSON.stringify(rows[idx]));
          } else {
            const copy = JSON.parse(JSON.stringify(values));
            rows.push(copy);
            if (table === "extracao_jobs") currentJob = copy;
          }
          return { data: values, error: null };
        },
        insert: async (values: any) => {
          const rows = db[table] || [];
          if (Array.isArray(values)) rows.push(...JSON.parse(JSON.stringify(values)));
          else rows.push(JSON.parse(JSON.stringify(values)));
          return { data: values, error: null };
        },
        delete: () => {
          return {
            eq: () => ({
              in: async () => ({ data: null, error: null }),
            }),
          };
        },
      };
      return chain;
    },
    storage: {
      from: () => ({
        download: async () => {
          if (initial.storageMd) {
            return {
              data: {
                text: async () => initial.storageMd,
              },
              error: null,
            };
          }
          return { data: null, error: { message: "Storage file not found" } };
        },
      }),
    },
    getCurrentJob: () => currentJob,
  };

  return client;
}

describe("Regressão - Isolamento de Lotes, Timeout e Orçamento", () => {
  it("a) um lote que estoura não derruba a leitura", async () => {
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 4, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "leitura_ia",
      total: 4,
      concluidos: 0,
      estado: "processando",
      metadata: {
        paginas: [{ numero: 1, texto: "pagina 1" }],
        lotes: [
          { id: "lote-1", texto: "Unidade 101 área 50m2" },
          { id: "lote-2", texto: "Unidade com erro irrevogável" }, // < 2000 caracteres, não divisível
          { id: "lote-3", texto: "Unidade 103 área 52m2" },
          { id: "lote-4", texto: "Unidade 104 área 53m2" },
        ],
        cursorLote: 0,
        candidatas: [],
        tokensInput: 0,
        tokensOutput: 0,
        chamadasIa: 0,
        chamadasCache: 0,
        lotesComErro: 0,
        lotesPendentes: [],
        tipologiaDetectada: "predio",
        linhasLidasQuadroIds: [],
      },
    };

    const supabase = createMockSupabase({ doc: mockDoc, condominio: mockCond, job: mockJob });
    const chamadasFeitas: string[] = [];

    const mockChamarIa = async (_apiKey: string, _system: string, userPrompt: string) => {
      chamadasFeitas.push(userPrompt);
      if (userPrompt.includes("Lote 2/4")) {
        throw new ErroTimeoutIA(30000, "Timeout simulado no lote 2");
      }
      const match = userPrompt.match(/Unidade (\d+)/);
      const num = match ? match[1] : "100";
      return {
        data: {
          unidades: [
            {
              numero: num,
              tipo: "apartamento",
              medidas: [
                {
                  campo: "area_privativa",
                  valor_bruto: "50,00",
                  escala: "m2",
                  trecho: `Unidade ${num} área 50m2`,
                },
              ],
            },
          ],
        },
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      };
    };

    const res = await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
      orcamentoMs: 60_000,
      chamarIa: mockChamarIa as any,
    });

    expect(res.estado).toBe("pronto_com_pendencias");
    expect(res.lotes_pendentes).toBeDefined();
    expect(res.lotes_pendentes?.length).toBe(1);
    expect(res.lotes_pendentes?.[0]?.lote).toBe(2);

    const numerosLidos = res.unidades?.map((u) => u.numero) ?? [];
    expect(numerosLidos).toContain("101");
    expect(numerosLidos).toContain("103");
    expect(numerosLidos).toContain("104");
  });

  it("b) timeout divide em vez de repetir", async () => {
    const textoLongo = "A".repeat(2000) + "\n\n" + "B".repeat(2000); // 4002 caracteres
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 2, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "leitura_ia",
      total: 1,
      concluidos: 0,
      estado: "processando",
      metadata: {
        paginas: [{ numero: 1, texto: "pagina 1" }],
        lotes: [{ id: "lote-1", texto: textoLongo }],
        cursorLote: 0,
        candidatas: [],
        tokensInput: 0,
        tokensOutput: 0,
        chamadasIa: 0,
        chamadasCache: 0,
        lotesComErro: 0,
        lotesPendentes: [],
        tipologiaDetectada: "predio",
        linhasLidasQuadroIds: [],
      },
    };

    const supabase = createMockSupabase({ doc: mockDoc, condominio: mockCond, job: mockJob });
    const tamanhosChamados: number[] = [];

    const mockChamarIa = async (_apiKey: string, _system: string, userPrompt: string) => {
      tamanhosChamados.push(userPrompt.length);
      // Na primeira chamada com o texto integral (~4000 caracteres), estoura
      if (userPrompt.length > 3000) {
        throw new ErroTimeoutIA(30000, "Timeout simulado no lote grande");
      }
      return {
        data: {
          unidades: [
            {
              numero: tamanhosChamados.length === 2 ? "101" : "102",
              tipo: "apartamento",
              medidas: [
                {
                  campo: "area_privativa",
                  valor_bruto: "60,00",
                  escala: "m2",
                  trecho: "60m2",
                },
              ],
            },
          ],
        },
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      };
    };

    let res = await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
      orcamentoMs: 60_000,
      chamarIa: mockChamarIa as any,
    });
    while (!res.concluido) {
      res = await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
        orcamentoMs: 60_000,
        chamarIa: mockChamarIa as any,
      });
    }

    expect(res.estado).toBe("pronto");
    expect(tamanhosChamados.length).toBe(3);
    expect(tamanhosChamados.filter((t) => t > 3000).length).toBe(1);
    expect(res.lotes_pendentes).toBeUndefined();
  });

  it("c) o orçamento é respeitado com concorrência", async () => {
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 5, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "leitura_ia",
      total: 5,
      concluidos: 0,
      estado: "processando",
      metadata: {
        lotes: [
          { id: "lote-1", texto: "Unidade 101" },
          { id: "lote-2", texto: "Unidade 102" },
          { id: "lote-3", texto: "Unidade 103" },
          { id: "lote-4", texto: "Unidade 104" },
          { id: "lote-5", texto: "Unidade 105" },
        ],
        cursorLote: 0,
        candidatas: [],
        tokensInput: 0,
        tokensOutput: 0,
        chamadasIa: 0,
        chamadasCache: 0,
        lotesComErro: 0,
        lotesPendentes: [],
        tipologiaDetectada: "predio",
        linhasLidasQuadroIds: [],
      },
    };

    const supabase = createMockSupabase({ doc: mockDoc, condominio: mockCond, job: mockJob });
    let chamadas = 0;

    const realDateNow = Date.now;
    const startMockTime = realDateNow();
    let timeOffset = 0;
    Date.now = () => startMockTime + timeOffset;

    const mockChamarIa = async () => {
      chamadas++;
      // Avança o tempo em 14.000ms durante o primeiro lote do primeiro batch
      timeOffset += 14_000;
      return {
        data: {
          unidades: [{ numero: "101", tipo: "apartamento", medidas: [] }],
        },
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      };
    };

    try {
      const res = await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
        orcamentoMs: 18_000,
        chamarIa: mockChamarIa as any,
      });

      // Primeiro batch de 4 rodou em paralelo, consumiu tempo e sobrou < 10s, lote 5 fica para a próxima
      expect(chamadas).toBe(4);
      expect(res.concluido).toBe(false);
      expect(res.concluidos).toBe(4);
      expect(res.etapa).toBe("leitura_ia");
    } finally {
      Date.now = realDateNow;
    }
  });

  it("d) o Router não existe mais", async () => {
    const paginas20Md = Array.from(
      { length: 20 },
      (_, i) => `---\n## Página ${i + 1}\n\nPágina ${i + 1} da convenção com regras.`,
    ).join("\n\n");
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 20, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "carregamento_e_roteamento",
      total: 4,
      concluidos: 0,
      estado: "processando",
      metadata: {},
    };

    const supabase = createMockSupabase({
      doc: mockDoc,
      condominio: mockCond,
      job: mockJob,
      storageMd: paginas20Md,
    });

    let chamadasIaRouter = 0;
    const mockChamarIa = async () => {
      chamadasIaRouter++;
      return { data: {}, usage: { prompt_tokens: 0, completion_tokens: 0 } };
    };

    await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
      chamarIa: mockChamarIa as any,
    });

    expect(chamadasIaRouter).toBe(0);
    expect(supabase.getCurrentJob()?.etapa).toBe("segmentacao_e_descritiva");
    expect(supabase.getCurrentJob()?.metadata?.totalPaginas).toBe(20);
    expect(supabase.getCurrentJob()?.metadata?.paginas).toBeUndefined();
  });
});

describe("Regressão Teste 4: Âncoras, Orçamento, Concorrência e Determinístico", () => {
  it("a) 11 frases reais de âncora (8 casam, 3 retornam null)", async () => {
    const { reconhecerAncora } = await import("./extracao/ancoras");
    const frases = [
      { texto: "A unidade autônoma habitacional (Apartamento) de n° 101", casa: true },
      { texto: "O apartamento número 42-B do Bloco C", casa: true },
      { texto: "A loja comercial de número 05", casa: true },
      { texto: "CASA 12 localizada na Alameda dos Ipês", casa: true },
      { texto: "Garagem autônoma nº 15 no subsolo", casa: true },
      { texto: "O lote designado pelo nº 07 da Quadra 14", casa: true },
      { texto: "Sala comercial n. 304", casa: true },
      { texto: "Apartamento duplex nº 801", casa: true },
      { texto: "Nos termos do artigo 101 do Código Civil", casa: false },
      { texto: "A assembleia aprovou por 10 votos a reforma", casa: false },
      { texto: "O condomínio terá 42 unidades no total", casa: false },
    ];

    for (const f of frases) {
      const res = reconhecerAncora(f.texto);
      if (f.casa) {
        expect(res).not.toBeNull();
      } else {
        expect(res).toBeNull();
      }
    }
  });

  it("b) Primeira chamada recebe timeout cheio de 30s; chamada de 25s passa com orçamento de 50s", async () => {
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 2, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "leitura_ia",
      total: 1,
      concluidos: 0,
      estado: "processando",
      metadata: {
        lotes: [{ id: "lote-1", texto: "Unidade 101" }],
        cursorLote: 0,
        candidatas: [],
        tokensInput: 0,
        tokensOutput: 0,
        chamadasIa: 0,
        chamadasCache: 0,
        lotesComErro: 0,
        lotesPendentes: [],
      },
    };

    const supabase = createMockSupabase({
      doc: mockDoc,
      condominio: mockCond,
      job: mockJob,
      storageMd: "## Página 1\n\nUnidade 101",
    });
    let timeoutRecebido = 0;

    const mockChamarIa = async (_key: string, _sys: string, _user: string, opts?: { timeoutMs?: number }) => {
      timeoutRecebido = opts?.timeoutMs ?? 0;
      return {
        data: { unidades: [{ numero: "101", tipo: "apartamento", medidas: [] }] },
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      };
    };

    const res = await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
      orcamentoMs: 50_000,
      chamarIa: mockChamarIa as any,
    });

    expect(timeoutRecebido).toBe(30_000);
    expect(res.ok).toBe(true);
  });

  it("c) Rodada nunca termina sem tentar ao menos 1 chamada", async () => {
    const mockDoc = { id: "doc-1", condominio_id: "cond-1", nome_arquivo: "conv.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 2, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-1",
      etapa: "leitura_ia",
      total: 2,
      concluidos: 0,
      estado: "processando",
      metadata: {
        lotes: [
          { id: "lote-1", texto: "Unidade 101" },
          { id: "lote-2", texto: "Unidade 102" },
        ],
        cursorLote: 0,
        candidatas: [],
        tokensInput: 0,
        tokensOutput: 0,
        chamadasIa: 0,
        chamadasCache: 0,
        lotesComErro: 0,
        lotesPendentes: [],
      },
    };

    const supabase = createMockSupabase({
      doc: mockDoc,
      condominio: mockCond,
      job: mockJob,
      storageMd: "## Página 1\n\nUnidade 101\n\nUnidade 102",
    });
    let chamadas = 0;

    const mockChamarIa = async () => {
      chamadas++;
      return {
        data: { unidades: [{ numero: "101", tipo: "apartamento", medidas: [] }] },
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      };
    };

    // Mesmo com orçamento pequeno, a rodada sempre tenta ao menos uma chamada
    await processarExtracaoRodada(supabase, "doc-1", "fake-key", {
      orcamentoMs: 1,
      chamarIa: mockChamarIa as any,
    });

    expect(chamadas).toBeGreaterThanOrEqual(1);
  });

  it("d) Metadata magro (< 200 KB para doc de 40 páginas)", async () => {
    const paginas40Md = Array.from(
      { length: 40 },
      (_, i) => `---\n## Página ${i + 1}\n\nTexto longo da página ${i + 1} com múltiplos artigos e regras de condomínio repetidas para aumentar o volume.\n` +
        "Artigo 1. O condomínio destina-se a fins residenciais.\n".repeat(20),
    ).join("\n\n");

    const mockDoc = { id: "doc-40", condominio_id: "cond-1", nome_arquivo: "conv40.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 40, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-40",
      etapa: "carregamento_e_roteamento",
      total: 4,
      concluidos: 0,
      estado: "processando",
      metadata: {},
    };

    const supabase = createMockSupabase({
      doc: mockDoc,
      condominio: mockCond,
      job: mockJob,
      storageMd: paginas40Md,
    });

    await processarExtracaoRodada(supabase, "doc-40", "fake-key");

    const jobAposEtapa1 = supabase.getCurrentJob();
    const tamanhoEtapa1 = JSON.stringify(jobAposEtapa1?.metadata ?? {}).length;
    expect(tamanhoEtapa1).toBeLessThan(200 * 1024);
    expect(jobAposEtapa1?.metadata?.paginas).toBeUndefined();
    expect(jobAposEtapa1?.metadata?.textoIntegral).toBeUndefined();
  });

  it("e) 0 chamadas de IA quando determinístico resolve todas as unidades", async () => {
    // Tabela com 3 unidades completas com área e fração
    const tabelaMd = [
      "## Página 1",
      "| Unidade | Área Privativa | Fração Ideal |",
      "| :--- | :--- | :--- |",
      "| Apto 101 | 75,50 | 0,333333 |",
      "| Apto 102 | 75,50 | 0,333333 |",
      "| Apto 103 | 75,50 | 0,333334 |",
      "",
      "Texto das regras que antes geraria censo de 800 linhas:",
      "Artigo 1. Conforme a lei 4591...",
      "Artigo 2. Os apartamentos devem respeitar o silêncio...",
    ].join("\n");

    const mockDoc = { id: "doc-det", condominio_id: "cond-1", nome_arquivo: "tabela.pdf", status_processamento: "pronto" };
    const mockCond = { categoria: "predio", qtd_unidades: 3, owner_id: "u-1" };
    const mockJob = {
      documento_id: "doc-det",
      etapa: "carregamento_e_roteamento",
      total: 4,
      concluidos: 0,
      estado: "processando",
      metadata: {},
    };

    const supabase = createMockSupabase({
      doc: mockDoc,
      condominio: mockCond,
      job: mockJob,
      storageMd: tabelaMd,
    });

    let chamadasIa = 0;
    const mockChamarIa = async () => {
      chamadasIa++;
      return { data: {}, usage: { prompt_tokens: 0, completion_tokens: 0 } };
    };

    // Rodada 1: carregamento
    await processarExtracaoRodada(supabase, "doc-det", "fake-key", { chamarIa: mockChamarIa as any });
    expect(supabase.getCurrentJob()?.etapa).toBe("segmentacao_e_descritiva");

    // Rodada 2: segmentacao_e_descritiva (deve concluir sem chamar IA)
    const res2 = await processarExtracaoRodada(supabase, "doc-det", "fake-key", { chamarIa: mockChamarIa as any });

    expect(chamadasIa).toBe(0);
    expect(res2.concluido).toBe(true);
    expect(res2.etapa).toBe("concluido");
    expect(res2.unidades?.length).toBe(3);
  });

  it("f) Teste 2 continua passando (32 aptos, 75.90 m², fração 0.033395)", () => {
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

