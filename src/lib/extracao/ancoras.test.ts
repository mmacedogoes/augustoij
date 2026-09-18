import { describe, expect, it } from "vitest";
import {
  PADROES_ANCORA,
  PADROES_ESCOPO,
  reconhecerAncora,
  reconhecerEscopo,
  gerarChaveIdentidade,
} from "./ancoras";

describe("Biblioteca de Reconhecimento de Âncoras e Escopo", () => {
  describe("reconhecerAncora", () => {
    it("reconhece 'APARTAMENTO DE N°: - 101'", () => {
      const res = reconhecerAncora("APARTAMENTO DE N°: - 101");
      expect(res).not.toBeNull();
      expect(res?.numero).toBe("101");
      expect(res?.sufixo).toBeNull();
      expect(res?.padrao).toBe("apartamento");
      expect(gerarChaveIdentidade(res!.numero, res!.sufixo)).toBe("|101");
    });

    it("reconhece 'APTO. Nº 101-A' com sufixo A", () => {
      const res = reconhecerAncora("APTO. Nº 101-A");
      expect(res).not.toBeNull();
      expect(res?.numero).toBe("101");
      expect(res?.sufixo).toBe("A");
      expect(res?.padrao).toBe("apartamento");
      expect(gerarChaveIdentidade(res!.numero, res!.sufixo)).toBe("|101A");
    });

    it("reconhece 'Unidade autônoma nº 101 –'", () => {
      const res = reconhecerAncora("Unidade autônoma nº 101 –");
      expect(res).not.toBeNull();
      expect(res?.numero).toBe("101");
      expect(res?.sufixo).toBeNull();
      expect(res?.padrao).toBe("unidade_autonoma");
      expect(gerarChaveIdentidade(res!.numero, res!.sufixo)).toBe("|101");
    });

    it("reconhece '| 101 | 75,90 |' como celula_tabela", () => {
      const res = reconhecerAncora("| 101 | 75,90 |");
      expect(res).not.toBeNull();
      expect(res?.numero).toBe("101");
      expect(res?.sufixo).toBeNull();
      expect(res?.padrao).toBe("celula_tabela");
      expect(gerarChaveIdentidade(res!.numero, res!.sufixo)).toBe("|101");
    });

    it("NÃO captura 'ARE' nem sufixo de palavra em 'Lote 01 - área de terreno de 250,00 m2'", () => {
      const res = reconhecerAncora("Lote 01 - área de terreno de 250,00 m2");
      expect(res).not.toBeNull();
      expect(res?.numero).toBe("01");
      expect(res?.sufixo).toBeNull();
      expect(res?.padrao).toBe("lote");
      expect(gerarChaveIdentidade(res!.numero, res!.sufixo)).toBe("|01");
    });

    it("reconhece 'unidade autonoma', 'casa', 'sala/loja'", () => {
      const aut = reconhecerAncora("Unidade Autônoma nº 402");
      expect(aut?.padrao).toBe("unidade_autonoma");
      expect(aut?.numero).toBe("402");

      const casa = reconhecerAncora("Casa 12-B");
      expect(casa?.padrao).toBe("casa");
      expect(casa?.numero).toBe("12");
      expect(casa?.sufixo).toBe("B");

      const sala = reconhecerAncora("Sala nº 304");
      expect(sala?.padrao).toBe("sala_loja");
      expect(sala?.numero).toBe("304");
    });

    it("a) âncoras das redações reais: 8 casam com número certo e 3 devolvem nulo", () => {
      // 8 que devem casar
      const c1 = reconhecerAncora("A unidade autônoma habitacional (Apartamento) de n° 101");
      expect(c1).not.toBeNull();
      expect(c1?.numero).toBe("101");

      const c2 = reconhecerAncora("A unidade autônoma de N.º 601A");
      expect(c2).not.toBeNull();
      expect(c2?.numero).toBe("601");
      expect(c2?.sufixo).toBe("A");

      const c3 = reconhecerAncora("APARTAMENTO DE N°: - 101");
      expect(c3).not.toBeNull();
      expect(c3?.numero).toBe("101");

      const c4 = reconhecerAncora("Lote 05 - área de terreno");
      expect(c4).not.toBeNull();
      expect(c4?.numero).toBe("05");

      const c5 = reconhecerAncora("Apartamento nº 1.201-B");
      expect(c5).not.toBeNull();
      expect(c5?.numero).toBe("1201");
      expect(c5?.sufixo).toBe("B");

      const c6 = reconhecerAncora("A unidade autônoma residencial (Casa) de nº 12");
      expect(c6).not.toBeNull();
      expect(c6?.numero).toBe("12");

      const c7 = reconhecerAncora("| 101 | 40,9462 | m² |");
      expect(c7).not.toBeNull();
      expect(c7?.numero).toBe("101");

      const c8 = reconhecerAncora("A unidade autônoma de N.º 601A possui");
      expect(c8).not.toBeNull();
      expect(c8?.numero).toBe("601");
      expect(c8?.sufixo).toBe("A");

      // 3 que devem devolver nulo
      expect(
        reconhecerAncora(
          "Permitir o ingresso do Síndico em sua unidade autônoma (lote), quando indispensável",
        ),
      ).toBeNull();
      expect(
        reconhecerAncora("É vedado ao condômino alterar a fachada da unidade autônoma"),
      ).toBeNull();
      expect(
        reconhecerAncora(
          "As despesas serão rateadas entre as unidades autônomas na proporção de suas frações ideais",
        ),
      ).toBeNull();
    });
  });

  describe("reconhecerEscopo e Herança de Escopo", () => {
    it("reconhece diferentes formatos de cabeçalhos de escopo", () => {
      expect(reconhecerEscopo("QUADRA 03")).toBe("03");
      expect(reconhecerEscopo("QUADRA 12")).toBe("12");
      expect(reconhecerEscopo("BLOCO B")).toBe("B");
      expect(reconhecerEscopo("TORRE 01")).toBe("01");
      expect(reconhecerEscopo("QD. 5")).toBe("5");
      expect(reconhecerEscopo("SETOR A")).toBe("A");
      expect(reconhecerEscopo("PAVIMENTO 2")).toBe("2");
      expect(reconhecerEscopo("ANDAR 3")).toBe("3");
    });

    it("gera identidades distintas para 'Lote 01' dentro de 'QUADRA 03' vs 'QUADRA 12'", () => {
      const escopo1 = reconhecerEscopo("QUADRA 03");
      const ancora1 = reconhecerAncora("Lote 01");
      const id1 = gerarChaveIdentidade(ancora1!.numero, ancora1!.sufixo, escopo1);

      const escopo2 = reconhecerEscopo("QUADRA 12");
      const ancora2 = reconhecerAncora("Lote 01");
      const id2 = gerarChaveIdentidade(ancora2!.numero, ancora2!.sufixo, escopo2);

      expect(id1).toBe("03|01");
      expect(id2).toBe("12|01");
      expect(id1).not.toBe(id2);
    });

    it("mantém o escopo ativo até aparecer o próximo cabeçalho", () => {
      const linhas = [
        "QUADRA 01",
        "Lote 01 - área 200m2",
        "Lote 02 - área 210m2",
        "QUADRA 02",
        "Lote 01 - área 190m2",
      ];

      let escopoAtivo: string | null = null;
      const chaves: string[] = [];

      for (const linha of linhas) {
        const novoEscopo = reconhecerEscopo(linha);
        if (novoEscopo) {
          escopoAtivo = novoEscopo;
          continue;
        }
        const ancora = reconhecerAncora(linha);
        if (ancora) {
          chaves.push(gerarChaveIdentidade(ancora.numero, ancora.sufixo, escopoAtivo));
        }
      }

      expect(chaves).toEqual(["01|01", "01|02", "02|01"]);
    });
  });
});