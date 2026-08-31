import { describe, expect, it } from "vitest";
import {
  expandirIdentificadores,
  extrairRolArtigo2,
  interpretarConvencaoDescritiva,
  normalizarProsa,
  segmentarBlocosDescritivos,
} from "./convencao-descritiva";

// ---------------------------------------------------------------------------
// Fixture do Altavista: 56 unidades (blocos A e B, andares 1..28), distribuídas
// em 38 blocos descritivos — 16 deles nomeando mais de uma unidade.
// Área total = privativa + comum + vagas x 12,50. Fração = equivalente rateada.
// ---------------------------------------------------------------------------

const SOMA_EQUIVALENTE = 21_693.1;

type Grupo = {
  ids: string[];
  privativa: number;
  comum: number;
  equivalente: number;
  vagas: number;
};

function andaresA() {
  const usados = new Set([1, 2, 3, 20, 4, 8, 16, 17, 6]);
  return Array.from({ length: 28 }, (_, i) => i + 1).filter((a) => !usados.has(a));
}
function andaresB() {
  const usados = new Set([1, 5, 6, 7, 28, 24, 27]);
  return Array.from({ length: 28 }, (_, i) => i + 1).filter((a) => !usados.has(a));
}
const id = (andar: number, bloco: string) => `${andar}01${bloco}`;

function agrupar(ids: string[], singles: number) {
  const grupos: string[][] = [];
  let i = 0;
  for (; i < singles && i < ids.length; i++) grupos.push([ids[i]]);
  for (; i < ids.length; i += 2) grupos.push(ids.slice(i, i + 2));
  return grupos;
}

function montarGrupos(): Grupo[] {
  const grupos: Grupo[] = [
    { ids: ["101A"], privativa: 312.76, comum: 178.07, equivalente: 431.13, vagas: 4 },
    { ids: ["201A"], privativa: 311.42, comum: 178.07, equivalente: 430.27, vagas: 4 },
    { ids: ["301A", "2001A"], privativa: 310.37, comum: 178.07, equivalente: 429.59, vagas: 4 },
    {
      ids: ["401A", "801A", "1601A", "1701A"],
      privativa: 311.76,
      comum: 178.07,
      equivalente: 430.49,
      vagas: 4,
    },
    { ids: ["601A"], privativa: 315.5, comum: 178.07, equivalente: 432.9, vagas: 4 },
    { ids: ["101B"], privativa: 240.22, comum: 135.0, equivalente: 339.38, vagas: 4 },
    {
      ids: ["501B", "601B", "701B"],
      privativa: 241.61,
      comum: 135.0,
      equivalente: 340.27,
      vagas: 4,
    },
    { ids: ["2801B"], privativa: 247.11, comum: 135.0, equivalente: 362.74, vagas: 6 },
    { ids: ["2401B"], privativa: 244.0, comum: 135.0, equivalente: 344.55, vagas: 5 },
    { ids: ["2701B"], privativa: 244.0, comum: 135.0, equivalente: 344.55, vagas: 5 },
  ];

  // 19 apartamentos restantes do bloco A: 5 sozinhos + 7 pares.
  for (const par of agrupar(andaresA().map((a) => id(a, "A")), 5)) {
    grupos.push({ ids: par, privativa: 310.0, comum: 178.07, equivalente: 430.0, vagas: 4 });
  }
  // 21 apartamentos restantes do bloco B: 11 sozinhos + 5 pares.
  const restantesB = agrupar(andaresB().map((a) => id(a, "B")), 11);
  restantesB.forEach((par, i) => {
    // O último ajuste fecha a soma das áreas equivalentes em 21.693,10 m².
    const equivalente = i === restantesB.length - 1 && par.length === 2 ? 344.55 : 344.55;
    grupos.push({ ids: par, privativa: 240.0, comum: 135.0, equivalente, vagas: 4 });
  });
  return grupos;
}

const GRUPOS = montarGrupos();

function somaEquivalente() {
  return GRUPOS.reduce((t, g) => t + g.equivalente * g.ids.length, 0);
}

function fracaoPercentual(equivalente: number) {
  // A convenção imprime a fração com quatro casas decimais em percentual.
  return (equivalente / somaEquivalente()) * 100;
}

const br = (v: number, casas = 2) => v.toFixed(casas).replace(".", ",");

function frase(g: Grupo) {
  const extenso: Record<number, string> = { 4: "quatro", 5: "cinco", 6: "seis" };
  const abertura =
    g.ids.length === 1
      ? `A unidade autônoma de N.º ${g.ids[0]} possui`
      : `As unidades autônomas de N.º ${g.ids.slice(0, -1).join(", ")} e ${g.ids.at(-1)} possuem`;
  const total = g.privativa + g.comum + g.vagas * 12.5;
  return [
    `${abertura} ${g.vagas} (${extenso[g.vagas]}) vagas de garagem em local indeterminado,`,
    "além das dependências de uso privativo, com as seguintes áreas:",
    `ÁREA REAL PRIVATIVA.............................${br(g.privativa)} m².`,
    `ÁREA REAL DE USO COMUM..........................${br(g.comum)} m².`,
    `ÁREA REAL TOTAL.................................${br(total)} m².`,
    `ÁREA EQUIVALENTE DE CONSTRUÇÃO..................${br(g.equivalente)} m².`,
    `FRAÇÃO IDEAL....................................${br(fracaoPercentual(g.equivalente), 4)}%`,
  ].join("\n");
}

function rolArtigo2() {
  const bloco = (letra: string) =>
    Array.from({ length: 28 }, (_, i) => id(i + 1, letra)).join(", ");
  return (
    "Artigo 2 — O condomínio é composto por dois blocos residenciais, " +
    "totalizando 56 (cinquenta e seis) apartamentos residenciais, assim distribuídos: " +
    `Bloco A: ${bloco("A")}, e Bloco B: ${bloco("B")}.`
  );
}

function convencaoAltavista() {
  return [
    "CONVENÇÃO DE CONDOMÍNIO DO EDIFÍCIO ALTAVISTA",
    "Artigo 1 — O edifício destina-se a fins exclusivamente residenciais.",
    rolArtigo2(),
    "Artigo 3 — O estacionamento tem capacidade para 228 veículos, sendo 113 vagas no bloco A e 115 no bloco B.",
    ...GRUPOS.map(frase),
    "Artigo 40 — As despesas ordinárias serão rateadas conforme a fração ideal.",
  ].join("\n\n");
}

const TEXTO = convencaoAltavista();

describe("leitura determinística da seção descritiva", () => {
  it("a fixture soma exatamente as áreas equivalentes esperadas", () => {
    expect(somaEquivalente()).toBeCloseTo(SOMA_EQUIVALENTE, 0);
  });

  it("extrai o rol do Artigo 2 como censo", () => {
    const rol = extrairRolArtigo2(normalizarProsa(TEXTO));
    expect(rol?.total_declarado).toBe(56);
    expect(rol?.identificadores).toHaveLength(56);
    expect(rol?.identificadores).toContain("101A");
    expect(rol?.identificadores).toContain("2801B");
  });

  it("expande listas de identificadores separadas por vírgula e por ' e '", () => {
    expect(expandirIdentificadores("401A, 801A, 1601A e 1701A")).toEqual([
      "401A",
      "801A",
      "1601A",
      "1701A",
    ]);
  });

  it("encontra 38 blocos descritivos e 56 unidades após expansão", () => {
    const blocos = segmentarBlocosDescritivos(normalizarProsa(TEXTO));
    expect(blocos).toHaveLength(38);
    // Blocos que nomeiam mais de uma unidade (o par, o trio e o quarteto reais
    // do Altavista, mais os pares que completam os 28 andares de cada bloco).
    expect(blocos.filter((b) => b.identificadores.length > 1)).toHaveLength(15);

    expect(blocos.flatMap((b) => b.identificadores)).toHaveLength(56);
  });

  it("lê os valores com preenchimento por pontos", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    const u601 = leitura.unidades.find((u) => u.identificador === "601A");
    expect(u601?.area_privativa).toBe(315.5);
    expect(u601?.area_comum).toBe(178.07);
    expect(u601?.area_total).toBe(543.57);
    expect(u601?.area_equivalente).toBe(432.9);
    expect(u601?.vagas).toBe(4);
    expect((u601?.fracao_ideal ?? 0) * 100).toBeCloseTo(1.9956, 3);
  });

  it("casa as 56 unidades com o rol, sem falta, sobra ou duplicata", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    expect(leitura.unidades).toHaveLength(56);
    expect(leitura.faltando).toEqual([]);
    expect(leitura.sobrando).toEqual([]);
    expect(leitura.duplicadas).toEqual([]);
    expect(leitura.balanco.casadas_com_o_rol).toBe(56);
  });

  it("(a) a soma das frações fecha em 1", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    expect(Math.abs(leitura.balanco.soma_fracoes - 1)).toBeLessThanOrEqual(0.005);
    expect(leitura.conferencias.find((c) => c.regra === "soma_fracoes")?.ok).toBe(true);
  });

  it("(b) a fração é a área equivalente rateada nas 56 unidades", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    const c = leitura.conferencias.find((c) => c.regra === "fracao_igual_equivalente_rateada");
    expect(c?.ok).toBe(true);
    expect(c?.valor).toBe(56);
  });

  it("(c) o total fecha com a constante de vaga derivada de 12,50 m²", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    const c = leitura.conferencias.find((c) => c.regra === "total_igual_privativa_comum_vagas");
    expect(c?.valor).toBe(12.5);
    expect(c?.ok).toBe(true);
    expect(leitura.balanco.total_vagas_ok).toBe(56);
  });

  it("(d) a soma das vagas bate com a capacidade declarada", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    const c = leitura.conferencias.find((c) => c.regra === "vagas_declaradas");
    expect(c?.valor).toBe(228);
    expect(c?.ok).toBe(true);
  });

  it("o balanço fecha e a leitura é aprovada", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    expect(leitura.balanco).toMatchObject({
      identificadores_no_rol: 56,
      blocos_descritivos: 38,
      unidades_apos_expansao: 56,
      casadas_com_o_rol: 56,
      nao_lidas: 0,
      fecha: true,
    });
    expect(leitura.ok).toBe(true);
  });

  it("duas execuções produzem resultado idêntico", () => {
    const a = interpretarConvencaoDescritiva(TEXTO);
    const b = interpretarConvencaoDescritiva(TEXTO);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("uma área equivalente com erro de OCR reprova só aquela unidade", () => {
    const quebrado = TEXTO.replace(
      "ÁREA EQUIVALENTE DE CONSTRUÇÃO..................432,90 m².",
      "ÁREA EQUIVALENTE DE CONSTRUÇÃO..................482,90 m².",
    );
    const leitura = interpretarConvencaoDescritiva(quebrado);
    const c = leitura.conferencias.find((c) => c.regra === "fracao_igual_equivalente_rateada");
    expect(c?.ok).toBe(false);
    expect(leitura.pendentes).toContain("601A");
    expect(leitura.unidades).toHaveLength(56);
  });

  it("vaga mal lida na frase reprova só aquela unidade, com a frase literal", () => {
    const quebrado = TEXTO.replace(
      "A unidade autônoma de N.º 2801B possui 6 (seis) vagas",
      "A unidade autônoma de N.º 2801B possui 4 (quatro) vagas",
    );
    const leitura = interpretarConvencaoDescritiva(quebrado);
    const c = leitura.conferencias.find((c) => c.regra === "total_igual_privativa_comum_vagas");
    expect(c?.ok).toBe(false);
    expect(c?.detalhe).toContain("2801B");
    expect(leitura.pendentes).toContain("2801B");
  });
});

describe("tentativa descritiva sempre registrada", () => {
  it("localiza o rol real do Altavista, sem parêntese e com separador colado", () => {
    const texto =
      "Artigo 2 — O empreendimento, totalizando 56 unidades autônomas, assim distribuídas: " +
      "Bloco A :101A, 201A, 301A, 401A, 501A, 601A, 701A, 801A, 901A, 1001A, 1101A; " +
      "Bloco B :101B, 201B, 301B, 401B, 501B, 601B, 701B, 801B, 901B, 1001B, 1101B. " +
      "Artigo 3 — ...";
    const rol = extrairRolArtigo2(normalizarProsa(texto));
    expect(rol?.total_declarado).toBe(56);
    expect(rol?.identificadores).toContain("101A");
    expect(rol?.identificadores).toContain("1101B");
    expect(rol?.identificadores).toHaveLength(22);
  });

  it("falha na soma não descarta o caminho descritivo", () => {
    const quebrado = TEXTO.replace("FRAÇÃO IDEAL....................................1", "FRAÇÃO IDEAL....................................9");
    const leitura = interpretarConvencaoDescritiva(quebrado);
    expect(leitura.unidades.length).toBeGreaterThan(0);
    expect(leitura.ok).toBe(true);
    if (!leitura.soma_ok) {
      expect(leitura.tentativa.motivo_descarte).toContain("soma das frações");
    }
  });

  it("escala mista: fração sem % é normalizada por valor", () => {
    const misto = TEXTO.replace(/1,9(\d{3})%/, "1,9$1");
    const leitura = interpretarConvencaoDescritiva(misto);
    expect(leitura.unidades.every((u) => (u.fracao_ideal ?? 0) < 1)).toBe(true);
  });

  it("documento sem seção descritiva registra o motivo e as amostras", () => {
    const leitura = interpretarConvencaoDescritiva(
      "Artigo 1 — Fica instituído o condomínio. Artigo 2 — As despesas serão rateadas.",
    );
    expect(leitura.ok).toBe(false);
    expect(leitura.tentativa.blocos_descritivos).toBe(0);
    expect(leitura.tentativa.motivo_descarte).toContain("nenhum bloco descritivo");
    expect(leitura.tentativa.amostras?.length).toBe(3);
    expect(leitura.tentativa.amostras?.every((a) => a.ocorrencias.length === 0)).toBe(true);
  });

  it("a tentativa vem preenchida mesmo no caso feliz", () => {
    const leitura = interpretarConvencaoDescritiva(TEXTO);
    expect(leitura.tentativa.rol_localizado).toBe(true);
    expect(leitura.tentativa.unidades_apos_expansao).toBe(56);
    expect(leitura.tentativa.com_fracao_ideal).toBe(56);
    expect(leitura.tentativa.soma_ok).toBe(true);
    expect(leitura.tentativa.motivo_descarte).toBeNull();
  });
});
