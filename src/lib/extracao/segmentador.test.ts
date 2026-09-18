import { describe, expect, it } from "vitest";
import { segmentarRegistros } from "./segmentador";

describe("Segmentador de Registros Posicionais", () => {
  it("segmenta 32 apartamentos onde as colunas 1 e 3 têm medidas idênticas, preservando todas as frases de áreas", () => {
    // 8 andares, 4 apartamentos por andar = 32 apartamentos no total
    const andares = [1, 2, 3, 4, 5, 6, 7, 8];
    const colunas = [1, 2, 3, 4];

    const fraseColunas1e3 =
      "com área privativa de 75,90 m2, área de uso comum de 24,10 m2, perfazendo a área total de 100,00 m2 e fração ideal de 0,033395.";
    const fraseColunas2e4 =
      "com área privativa de 62,50 m2, área de uso comum de 18,50 m2, perfazendo a área total de 81,00 m2 e fração ideal de 0,029105.";

    // Monta o texto dividido em 2 páginas (andares 1 a 4 na página 1, 5 a 8 na página 2)
    const linhasPagina1: string[] = ["CONVENÇÃO DE CONDOMÍNIO - EDIFÍCIO TESTE 32", "QUADRO DESCRITIVO DAS UNIDADES AUTÔNOMAS:"];
    const linhasPagina2: string[] = ["CONTINUAÇÃO DO QUADRO DESCRITIVO:"];

    for (const andar of andares) {
      for (const col of colunas) {
        const num = `${andar}0${col}`;
        const fraseMedida = col === 1 || col === 3 ? fraseColunas1e3 : fraseColunas2e4;
        const textoUnidade = `APARTAMENTO Nº ${num} - localizado no ${andar}º pavimento, ${fraseMedida}`;

        if (andar <= 4) {
          linhasPagina1.push(textoUnidade);
        } else {
          linhasPagina2.push(textoUnidade);
        }
      }
    }

    const paginas = [
      { numero: 1, texto: linhasPagina1.join("\n\n") },
      { numero: 2, texto: linhasPagina2.join("\n\n") },
    ];

    const registros = segmentarRegistros(paginas, "doc-32-aptos");

    // 1. Deve produzir exatamente 32 registros, sem descartar ou colapsar nenhum
    expect(registros.length).toBe(32);

    // 2. Cada registro deve conter o seu respectivo identificador e sua frase de áreas completa
    for (let i = 0; i < 32; i++) {
      const andar = Math.floor(i / 4) + 1;
      const col = (i % 4) + 1;
      const numEsperado = `${andar}0${col}`;
      const fraseEsperada = col === 1 || col === 3 ? fraseColunas1e3 : fraseColunas2e4;

      const reg = registros[i];
      expect(reg.numero).toBe(numEsperado);
      expect(reg.padrao_ancora).toBe("apartamento_de_n");
      expect(reg.registro_id).toContain(`doc-32-aptos:`);
      expect(reg.texto).toContain(`APARTAMENTO Nº ${numEsperado}`);
      expect(reg.texto).toContain(fraseEsperada);
      expect(reg.motivo_descarte).toBeUndefined();
    }

    // 3. Verifica especificamente que todos os 16 apartamentos das colunas 1 e 3 (medidas 100% idênticas)
    // mantiveram suas frases individuais intactas
    const colunas1e3 = registros.filter((r) => r.numero.endsWith("1") || r.numero.endsWith("3"));
    expect(colunas1e3.length).toBe(16);
    for (const reg of colunas1e3) {
      expect(reg.texto).toContain("75,90 m2");
      expect(reg.texto).toContain("0,033395");
    }
  });

  it("marca 'identidade_repetida_no_documento' caso a mesma unidade apareça duas vezes, sem descartar", () => {
    const paginas = [
      {
        numero: 1,
        texto: "APARTAMENTO 101 - área privativa de 75,90 m2\n\nAPARTAMENTO 102 - área privativa de 62,50 m2",
      },
      {
        numero: 2,
        texto: "RELAÇÃO DE VAGAS DE GARAGEM:\nAPARTAMENTO 101 - vinculada à vaga nº 05",
      },
    ];

    const registros = segmentarRegistros(paginas, "doc-duplicata");
    expect(registros.length).toBe(3);

    expect(registros[0].numero).toBe("101");
    expect(registros[0].motivo_descarte).toBeUndefined();

    expect(registros[1].numero).toBe("102");
    expect(registros[1].motivo_descarte).toBeUndefined();

    expect(registros[2].numero).toBe("101");
    expect(registros[2].motivo_descarte).toBe("identidade_repetida_no_documento");
  });

  it("captura a continuação da unidade que transborda para a página seguinte antes da próxima âncora", () => {
    const paginas = [
      {
        numero: 1,
        texto: "APARTAMENTO 101 - área privativa de 75,90 m2 e área comum de",
      },
      {
        numero: 2,
        texto: "24,10 m2, fração ideal de 0,033395.\n\nAPARTAMENTO 102 - área privativa de 60,00 m2",
      },
    ];

    const registros = segmentarRegistros(paginas, "doc-transbordo");
    expect(registros.length).toBe(2);

    expect(registros[0].numero).toBe("101");
    expect(registros[0].texto).toContain("75,90 m2");
    expect(registros[0].texto).toContain("24,10 m2");
    expect(registros[0].texto).toContain("0,033395");

    expect(registros[1].numero).toBe("102");
    expect(registros[1].texto).toContain("60,00 m2");
    expect(registros[1].texto).not.toContain("0,033395");
  });
});