import { describe, expect, it } from "vitest";
import {
  expandirIntervalos,
  lerRegistro,
  converterValorPtBr,
} from "./rotulos";
import {
  expandirIdentificadores,
  extrairRolArtigo2,
} from "../convencao-descritiva";

describe("Famílias de Rótulos e Extração de Medidas", () => {
  describe("Captura de Medidas em Registros (lerRegistro)", () => {
    it("captura rótulo seguido de pontilhado (forma a)", () => {
      const texto = `
        ÁREA REAL PRIVATIVA.............................75,90 m².
        ÁREA REAL DE USO COMUM..........................24,10 m².
        ÁREA REAL TOTAL.................................100,00 m².
        ÁREA EQUIVALENTE DE CONSTRUÇÃO..................85,00 m².
        FRAÇÃO IDEAL....................................1,9956%
      `;
      const medidas = lerRegistro(texto);

      const privativa = medidas.find((m) => m.campo === "area_privativa");
      expect(privativa).toBeDefined();
      expect(privativa?.valor_bruto).toBe("75,90");
      expect(privativa?.valor_numerico).toBe(75.9);
      expect(privativa?.trecho).toContain("ÁREA REAL PRIVATIVA");

      const comum = medidas.find((m) => m.campo === "area_comum");
      expect(comum).toBeDefined();
      expect(comum?.valor_numerico).toBe(24.1);

      const total = medidas.find((m) => m.campo === "area_total");
      expect(total).toBeDefined();
      expect(total?.valor_numerico).toBe(100.0);

      const equiv = medidas.find((m) => m.campo === "area_equivalente");
      expect(equiv).toBeDefined();
      expect(equiv?.valor_numerico).toBe(85.0);

      const fracao = medidas.find((m) => m.campo === "fracao_ideal");
      expect(fracao).toBeDefined();
      expect(fracao?.valor_bruto).toBe("1,9956");
      expect(fracao?.valor_numerico).toBeCloseTo(0.019956);
      expect(fracao?.escala).toBe("percentual");
    });

    it("captura rótulo embutido na prosa com 'de' (forma b)", () => {
      const texto = `
        A unidade autônoma possui uma Área de construção privativa real de 75,90 m2,
        área de uso comum de 24,10 m2, área total de 100,00 m2 e uma fração ideal de 0,033395.
        Contém 2 vagas de garagem.
      `;
      const medidas = lerRegistro(texto);

      const privativa = medidas.find((m) => m.campo === "area_privativa");
      expect(privativa).toBeDefined();
      expect(privativa?.valor_numerico).toBe(75.9);
      expect(privativa?.trecho).toContain("Área de construção privativa real de 75,90 m2");

      const comum = medidas.find((m) => m.campo === "area_comum");
      expect(comum).toBeDefined();
      expect(comum?.valor_numerico).toBe(24.1);

      const fracao = medidas.find((m) => m.campo === "fracao_ideal");
      expect(fracao).toBeDefined();
      expect(fracao?.valor_numerico).toBe(0.033395);
      expect(fracao?.escala).toBe("decimal");

      const vagas = medidas.find((m) => m.campo === "vagas");
      expect(vagas).toBeDefined();
      expect(vagas?.valor_numerico).toBe(2);
    });

    it("captura variações: área útil, exclusiva, coeficiente de rateio, permilagem, área do terreno", () => {
      const texto = `
        Lote com área do terreno de 360,00 m2, área útil coberta de 145,50 m2,
        área global de 180,00 m2, coeficiente de rateio de 0,025 e 4 (quatro) vagas de garagem.
      `;
      const medidas = lerRegistro(texto);

      const terreno = medidas.find((m) => m.campo === "area_terreno");
      expect(terreno?.valor_numerico).toBe(360.0);

      const privativa = medidas.find((m) => m.campo === "area_privativa");
      expect(privativa?.valor_numerico).toBe(145.5);

      const total = medidas.find((m) => m.campo === "area_total");
      expect(total?.valor_numerico).toBe(180.0);

      const fracao = medidas.find((m) => m.campo === "fracao_ideal");
      expect(fracao?.valor_numerico).toBe(0.025);

      const vagas = medidas.find((m) => m.campo === "vagas");
      expect(vagas?.valor_numerico).toBe(4);
    });

    it("aceita ponto de milhar e vírgula decimal", () => {
      const { numerico: val1 } = converterValorPtBr("1.250,75", "m2");
      expect(val1).toBe(1250.75);

      const { numerico: val2, escala: esc2 } = converterValorPtBr("2.500", "‰");
      expect(val2).toBe(2.5);
      expect(esc2).toBe("milesimo");
    });
  });

  describe("Expansão de Intervalos (expandirIntervalos)", () => {
    it("expande '101 a 104, 201 a 204' gerando exatamente os 8 apartamentos", () => {
      const resultado = expandirIntervalos("101 a 104, 201 a 204");
      expect(resultado).toEqual([
        "101",
        "102",
        "103",
        "104",
        "201",
        "202",
        "203",
        "204",
      ]);
    });

    it("aceita os diferentes separadores: 'a', 'até', 'ao', '-', '–'", () => {
      expect(expandirIntervalos("101 a 103")).toEqual(["101", "102", "103"]);
      expect(expandirIntervalos("101 até 103")).toEqual(["101", "102", "103"]);
      expect(expandirIntervalos("101 ao 103")).toEqual(["101", "102", "103"]);
      expect(expandirIntervalos("101 - 103")).toEqual(["101", "102", "103"]);
      expect(expandirIntervalos("101 – 103")).toEqual(["101", "102", "103"]);
    });

    it("exige que os extremos tenham o mesmo número de dígitos", () => {
      // 1 tem 1 dígito, 104 tem 3 dígitos: não deve expandir de 1 a 104
      const res = expandirIntervalos("1 a 104");
      expect(res).not.toContain("50");
    });

    it("expande intervalos com sufixo de bloco: '101A a 104A'", () => {
      expect(expandirIntervalos("101A a 104A")).toEqual([
        "101A",
        "102A",
        "103A",
        "104A",
      ]);
    });

    it("preserva zeros à esquerda em '01 a 04'", () => {
      expect(expandirIntervalos("01 a 04")).toEqual(["01", "02", "03", "04"]);
    });
  });

  describe("Integração com o rol do Artigo 2 em convencao-descritiva.ts", () => {
    it("expande o rol de 32 apartamentos com intervalos no corpo", () => {
      const texto = `
        totalizando 32 apartamentos assim distribuídos:
        101 a 104, 201 a 204, 301 a 304, 401 a 404,
        501 a 504, 601 a 604, 701 a 704, 801 a 804.
        Artigo 3 - Da administração...
      `;
      const rol = extrairRolArtigo2(texto);
      expect(rol).not.toBeNull();
      expect(rol?.total_declarado).toBe(32);
      expect(rol?.identificadores.length).toBe(32);
      expect(rol?.identificadores).toContain("102");
      expect(rol?.identificadores).toContain("203");
      expect(rol?.identificadores).toContain("804");
    });

    it("expandeIdentificadores aceita listas simples e intervalos", () => {
      expect(expandirIdentificadores("101A, 201A, 301A")).toEqual([
        "101A",
        "201A",
        "301A",
      ]);
      expect(expandirIdentificadores("101 a 104")).toEqual([
        "101",
        "102",
        "103",
        "104",
      ]);
    });
  });
});