import { describe, expect, it } from "vitest";
import { detectarTipologia } from "./tipologia";
import { getCategoriaMeta, normalizeCategoria } from "../categorias-condominio";

describe("Detecção de Tipologia e Divergência", () => {
  it("classifica edifício residencial com apartamentos como 'predio'", () => {
    const texto = `
      CONDOMÍNIO EDIFÍCIO RESIDENCIAL SOLAR DAS ACÁCIAS
      Artigo 1º - O condomínio é composto por 1 torre residencial contendo 32 apartamentos.
      APARTAMENTO 101: possui área real privativa de 75,90 m2, fração ideal de 0,03125.
      APARTAMENTO 102: possui área real privativa de 75,90 m2, fração ideal de 0,03125.
      APARTAMENTO 201: possui área real privativa de 75,90 m2, fração ideal de 0,03125.
      APARTAMENTO 202: possui área real privativa de 75,90 m2, fração ideal de 0,03125.
      APARTAMENTO 301: possui área real privativa de 85,00 m2, fração ideal de 0,03125.
      Subsolo com vagas de garagem, elevador e hall de entrada.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("predio");
  });

  it("classifica condomínio de lotes / loteamento fechado como 'casas_lotes'", () => {
    const texto = `
      CONVENÇÃO DE CONDOMÍNIO DE LOTES - RESIDENCIAL VILA DOS IPÊS
      O empreendimento constitui loteamento fechado regido pela Lei 6.766/79 e Código Civil.
      QUADRA A
      LOTE Nº 01 - Área do lote de 360,00 m2, testada de 12 metros, recuo frontal de 4 metros.
      LOTE Nº 02 - Área do terreno de 360,00 m2, fração ideal no solo de 0,0125.
      LOTE Nº 03 - Área privativa de solo de 360,00 m2.
      QUADRA B
      LOTE Nº 01 - Área do terreno de 450,00 m2.
      LOTE Nº 02 - Área do terreno de 450,00 m2.
      Total de 15 quadras e 180 lotes residenciais.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("casas_lotes");
  });

  it("classifica edifício comercial com consultórios/escritórios como 'salas_comerciais'", () => {
    const texto = `
      CONVENÇÃO DO EDIFÍCIO COMERCIAL CENTRO EMPRESARIAL EXECUTIVE
      Composto por 10 andares de salas comerciais e conjuntos comerciais.
      SALA 101 - área privativa de 42,00 m2, fração ideal de 0,015.
      SALA 102 - área privativa de 42,00 m2, fração ideal de 0,015.
      SALA 201 - área privativa de 50,00 m2, fração ideal de 0,018.
      SALA 202 - área privativa de 50,00 m2, fração ideal de 0,018.
      Destinado exclusivamente a escritórios e consultórios.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("salas_comerciais");
  });

  it("classifica shopping center como 'shopping'", () => {
    const texto = `
      REGULAMENTO GERAL E CONVENÇÃO DO SHOPPING CENTER BOULEVARD
      O empreendimento conta com área bruta locável (ABL) de 45.000 m2.
      LOJA 101: localizada no Piso L1, área de 120,00 m2.
      LOJA 102: localizada no Piso L1, área de 80,00 m2.
      LOJA 201: loja âncora, localizada no Piso L2, área de 1.500,00 m2.
      Praça de alimentação com 20 quiosques e lojas satélites.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("shopping");
  });

  it("classifica condomínio logístico com armazéns e docas como 'galpoes'", () => {
    const texto = `
      CONDOMÍNIO LOGÍSTICO E PARQUE INDUSTRIAL BUSINESS PARK
      Composto por módulos logísticos com pé-direito de 12m, docas niveladoras e pátio de manobras.
      GALPÃO 01: módulo de armazenagem com área privativa de 2.500 m2.
      GALPÃO 02: módulo com área de 2.500 m2 e 6 docas.
      GALPÃO 03: módulo logístico com área de 5.000 m2.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("galpoes");
  });

  it("classifica empreendimento com apartamentos e lojas como 'misto'", () => {
    const texto = `
      CONDOMÍNIO MIXED USE METRÓPOLE
      Edifício composto por embasamento comercial e torre residencial.
      LOJA 01: no pavimento térreo comercial, área de 150,00 m2.
      LOJA 02: pavimento térreo comercial, área de 180,00 m2.
      LOJA 03: pavimento térreo comercial, área de 210,00 m2.
      LOJA 04: pavimento térreo comercial, área de 95,00 m2.
      LOJA 05: pavimento térreo comercial, área de 110,00 m2.
      APARTAMENTO 101: torre residencial, área de 65,00 m2.
      APARTAMENTO 102: torre residencial, área de 65,00 m2.
      APARTAMENTO 201: torre residencial, área de 65,00 m2.
      APARTAMENTO 202: torre residencial, área de 65,00 m2.
      APARTAMENTO 301: torre residencial, área de 65,00 m2.
      APARTAMENTO 302: torre residencial, área de 65,00 m2.
    `;
    const tipologia = detectarTipologia(texto);
    expect(tipologia).toBe("misto");
  });

  describe("Tratamento de divergência cadastrada vs detectada", () => {
    it("detecta divergência quando cadastrado é 'predio' mas documento é de lotes", () => {
      const textoLotes = `
        CONDOMÍNIO DE LOTES MORADA DO SOL
        QUADRA 1, LOTE 10: área do lote 400 m2.
        QUADRA 1, LOTE 11: área do lote 400 m2.
        QUADRA 2, LOTE 01: área do lote 450 m2.
      `;
      const tipologiaDetectada = detectarTipologia(textoLotes);
      const categoriaCadastrada = "predio";

      const tipologiaNorm = normalizeCategoria(tipologiaDetectada);
      const cadastradaNorm = normalizeCategoria(categoriaCadastrada);

      expect(tipologiaDetectada).toBe("casas_lotes");
      expect(tipologiaNorm).toBe("casas");
      expect(cadastradaNorm).toBe("predio");
      expect(tipologiaNorm !== cadastradaNorm).toBe(true);

      // Metadados usados na extração passam a ser da detectada
      const meta = getCategoriaMeta(tipologiaDetectada);
      expect(meta.vocab.unidade).toBe("Lote");
      expect(meta.vocab.bloco).toBe("Quadra");
      expect(meta.vocabIA).toContain("QUADRAS");
    });

    it("não considera divergente quando cadastrado é 'casas' e detectado é 'casas_lotes'", () => {
      const cadastradaNorm = normalizeCategoria("casas");
      const detectadaNorm = normalizeCategoria("casas_lotes");
      expect(cadastradaNorm).toBe(detectadaNorm);
    });
  });
});