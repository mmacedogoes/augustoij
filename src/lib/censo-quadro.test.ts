import { describe, expect, it } from "vitest";
import { chunkText } from "./documentos.server";
import { construirCenso, resolverIdentidade, tokenizarIdentificador } from "./censo-linhas";
import { extrairUnidadesDeQuadros } from "./quadro-parser";
import { chaveUnidade, consolidar } from "./unidades-extracao.server";

const CABECALHO = [
  "| Unidade | Área privativa (m²) | Área comum (m²) | Área global (m²) | Fração ideal (%) |",
  "| --- | --- | --- | --- | --- |",
];

/** Quadro no formato Altavista: 56 unidades, blocos A e B, título acima. */
function fixtureAltavista() {
  const linhas: string[] = ["CONVENÇÃO DE CONDOMÍNIO ALTAVISTA", ""];
  const unidades: Array<{ bloco: string; numero: string }> = [];
  const formatos = [
    (n: string) => n,
    (n: string, b: string) => `${n}${b}`,
    (n: string) => `Apto ${n}`,
    (n: string, b: string) => `${n}-${b}`,
    (n: string) => `Unidade ${n}`,
  ];
  let i = 0;
  for (const bloco of ["A", "B"]) {
    linhas.push(`BLOCO ${bloco}`, "", ...CABECALHO);
    for (let andar = 1; andar <= 7; andar++) {
      for (let porta = 1; porta <= 4; porta++) {
        const numero = String(andar * 100 + porta);
        const rotulo = formatos[i % formatos.length](numero, bloco);
        i++;
        unidades.push({ bloco, numero });
        linhas.push(`| ${rotulo} | 100,00 | 20,00 | 120,00 | 1,785714% |`);
      }
    }
    linhas.push("");
  }
  return { texto: linhas.join("\n"), unidades };
}

function pipeline(texto: string, size = 900) {
  const chunks = chunkText(texto, size, 200).map((conteudo, i) => ({
    id: `c${i}`,
    conteudo,
    metadata: { ordem_global: i, trecho: i, pagina_inicio: i + 1, bloco: 0 },
  }));
  const censo = construirCenso("doc1", chunks);
  const quadro = extrairUnidadesDeQuadros(censo);
  return { censo, quadro };
}

describe("tokenizador de identificador", () => {
  it.each([
    ["601", "601", null],
    ["601A", "601", "A"],
    ["601 A", "601", "A"],
    ["Apto 601", "601", null],
    ["Apartamento 601", "601", null],
    ["601-A", "601", "A"],
    ["A-601", "601", "A"],
    ["Unidade 601", "601", null],
    ["Unid. 601", "601", null],
    ["Nº 601", "601", null],
    ["Loja 02", "02", null],
    ["Casa 12", "12", null],
    ["Sala 201", "201", null],
    ["Lote 15", "15", null],
    ["601/A", "601", "A"],
    ["601 - A", "601", "A"],
    ["Bloco B 601", "601", "B"],
  ])("lê %s", (celula, numero, bloco) => {
    expect(tokenizarIdentificador(celula)).toMatchObject({ numero, sufixoBloco: bloco });
  });

  it("devolve null para célula numérica de medida", () => {
    expect(tokenizarIdentificador("315,50")).toBeNull();
  });
});

describe("censo e parser do quadro Altavista", () => {
  const { texto, unidades: conhecidas } = fixtureAltavista();

  it("faz o censo de 56 linhas candidatas", () => {
    const { censo } = pipeline(texto);
    expect(censo.candidatas).toHaveLength(56);
  });

  it("resolve 56 unidades com bloco correto e nenhuma chave órfã", () => {
    const { quadro } = pipeline(texto);
    const { unidades, orfas } = consolidar(quadro.unidades, conhecidas);
    expect(orfas).toEqual([]);
    expect(unidades).toHaveLength(56);
    expect(unidades.every((u) => Boolean(u.bloco))).toBe(true);
    expect(unidades.some((u) => chaveUnidade(u.bloco ?? null, u.numero).startsWith("|"))).toBe(
      false,
    );
  });

  it("não deixa linha candidata sem leitura e fecha a soma das frações", () => {
    const { censo, quadro } = pipeline(texto);
    const naoLidas = censo.candidatas.filter((l) => !quadro.linhasLidas.has(l.linha_id));
    expect(naoLidas).toEqual([]);
    const { unidades } = consolidar(quadro.unidades, conhecidas);
    const soma = unidades.reduce((t, u) => t + (u.fracao_ideal ?? 0), 0);
    expect(soma).toBeCloseTo(1, 6);
  });

  it("produz saída idêntica em duas execuções", () => {
    const a = consolidar(pipeline(texto).quadro.unidades, conhecidas);
    const b = consolidar(pipeline(texto).quadro.unidades, conhecidas);
    expect(b).toEqual(a);
  });
});

describe("fusão e linhas puladas", () => {
  it("601A e 601B em trechos de continuação saem como duas unidades", () => {
    const linhas = ["BLOCO A", "", ...CABECALHO];
    for (let i = 0; i < 12; i++)
      linhas.push(`| ${601 + i} | 100,00 | 20,00 | 120,00 | 4,166667% |`);
    linhas.push("", "BLOCO B", "", ...CABECALHO);
    for (let i = 0; i < 12; i++)
      linhas.push(`| ${601 + i} | 100,00 | 20,00 | 120,00 | 4,166667% |`);
    const conhecidas = ["A", "B"].flatMap((bloco) =>
      Array.from({ length: 12 }, (_, i) => ({ bloco, numero: String(601 + i) })),
    );
    const { quadro } = pipeline(linhas.join("\n"), 600);
    const { unidades, orfas } = consolidar(quadro.unidades, conhecidas);
    expect(orfas).toEqual([]);
    expect(unidades).toHaveLength(24);
    expect(unidades.filter((u) => u.numero === "601")).toHaveLength(2);
  });

  it("linha que o parser não entende sobra para a IA em vez de sumir", () => {
    const linhas = [
      "BLOCO A",
      "",
      ...CABECALHO,
      "| 601 | 100,00 | 20,00 | 120,00 | 20,00% |",
      "| 602 | 100,00 | 20,00 | 120,00 | 20,00% |",
      "| 603 | 100,00 | 20,00 | 120,00 | 20,00% |",
      "",
      "O apartamento 604 possui área privativa de 100,00 m² e fração ideal de 20,00%.",
      "O apartamento 605 possui área privativa de 100,00 m² e fração ideal de 20,00%.",
    ];
    const { censo, quadro } = pipeline(linhas.join("\n"), 4000);
    expect(censo.candidatas).toHaveLength(5);
    expect(quadro.linhasLidas.size).toBe(3);
    const naoLidas = censo.candidatas.filter((l) => !quadro.linhasLidas.has(l.linha_id));
    expect(naoLidas.map((l) => l.texto)).toHaveLength(2);
  });
});

describe("resolverIdentidade", () => {
  const conhecidas = [
    { bloco: "A", numero: "601" },
    { bloco: "B", numero: "601" },
    { bloco: "A", numero: "701" },
  ];

  it("usa o bloco do contexto quando a linha não traz bloco", () => {
    expect(resolverIdentidade({ numero: "601", bloco_contexto: "B" }, conhecidas)).toMatchObject({
      bloco: "B",
      regra: "identidade_bloco_contexto",
    });
  });

  it("não inventa chave quando o número é ambíguo e não há contexto", () => {
    expect(resolverIdentidade({ numero: "601" }, conhecidas)).toMatchObject({
      status: "sem_correspondencia",
    });
  });

  it("resolve por número único", () => {
    expect(resolverIdentidade({ numero: "701" }, conhecidas)).toMatchObject({
      bloco: "A",
      regra: "identidade_numero_unico",
    });
  });
});
