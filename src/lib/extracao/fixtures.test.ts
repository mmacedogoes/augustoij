import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extrairUnidadesDoTexto, type UnidadeEsperadaFormatada } from "./pipeline";

type FixtureEsperada = {
  total: number;
  unidades: UnidadeEsperadaFormatada[];
};

type DivergenciaCampo = {
  campo: string;
  esperado: unknown;
  recebido: unknown;
};

type DivergenciaUnidade = {
  chave: string;
  tipo: "ausente_no_recebido" | "inesperada_no_recebido" | "campo_divergente";
  detalhes?: DivergenciaCampo[];
};

function chaveUnidade(u: { escopo: string | null; numero: string }): string {
  return u.escopo ? ${u.escopo}- : u.numero;
}

function dentroTolerancia(a: number | null, b: number | null, tol: number): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}

describe("Regressão de Extração de Unidades (Fixtures)", () => {
  const fixturesDir = path.resolve(__dirname, "fixtures");

  if (!fs.existsSync(fixturesDir)) {
    it.skip("Nenhuma pasta de fixtures encontrada", () => {});
    return;
  }

  const arquivos = fs.readdirSync(fixturesDir);
  const fixtureSlugs = arquivos
    .filter((f) => f.endsWith(".esperado.json"))
    .map((f) => f.replace(".esperado.json", ""));

  if (fixtureSlugs.length === 0) {
    it.skip("Nenhum arquivo .esperado.json encontrado em fixtures", () => {});
    return;
  }

  for (const slug of fixtureSlugs) {
    it(deve extrair unidades com fidelidade para o fixture: , () => {
      const esperadoPath = path.join(fixturesDir, ${slug}.esperado.json);
      const textoPath = path.join(fixturesDir, ${slug}.txt);

      expect(fs.existsSync(textoPath), Arquivo de texto não encontrado: .txt).toBe(true);

      const esperadoRaw = fs.readFileSync(esperadoPath, "utf-8");
      const esperado: FixtureEsperada = JSON.parse(esperadoRaw);

      const texto = fs.readFileSync(textoPath, "utf-8");
      const extraido = extrairUnidadesDoTexto(texto);

      const mapaEsperado = new Map<string, UnidadeEsperadaFormatada>();
      for (const u of esperado.unidades) {
        mapaEsperado.set(chaveUnidade(u), u);
      }

      const mapaRecebido = new Map<string, UnidadeEsperadaFormatada>();
      for (const u of extraido.unidades) {
        mapaRecebido.set(chaveUnidade(u), u);
      }

      const divergencias: DivergenciaUnidade[] = [];

      // 1) Checar unidades esperadas que faltaram ou divergiram em campos
      for (const [chave, esp] of mapaEsperado.entries()) {
        const rec = mapaRecebido.get(chave);
        if (!rec) {
          divergencias.push({
            chave,
            tipo: "ausente_no_recebido",
          });
          continue;
        }

        const errosCampos: DivergenciaCampo[] = [];

        // Comparar escopo
        if ((esp.escopo ?? null) !== (rec.escopo ?? null)) {
          errosCampos.push({
            campo: "escopo",
            esperado: esp.escopo,
            recebido: rec.escopo,
          });
        }

        // Comparar area_privativa (tolerância de 0.02 m²)
        if (!dentroTolerancia(esp.area_privativa, rec.area_privativa, 0.02)) {
          errosCampos.push({
            campo: "area_privativa",
            esperado: esp.area_privativa,
            recebido: rec.area_privativa,
          });
        }

        // Comparar fracao_ideal (tolerância de 0.00001)
        if (!dentroTolerancia(esp.fracao_ideal, rec.fracao_ideal, 1e-5)) {
          errosCampos.push({
            campo: "fracao_ideal",
            esperado: esp.fracao_ideal,
            recebido: rec.fracao_ideal,
          });
        }

        if (errosCampos.length > 0) {
          divergencias.push({
            chave,
            tipo: "campo_divergente",
            detalhes: errosCampos,
          });
        }
      }

      // 2) Checar unidades no recebido que não estavam no esperado (órfãs / inventadas)
      for (const [chave] of mapaRecebido.entries()) {
        if (!mapaEsperado.has(chave)) {
          divergencias.push({
            chave,
            tipo: "inesperada_no_recebido",
          });
        }
      }

      if (divergencias.length > 0 || extraido.total !== esperado.total) {
        const linhasRelatorio: string[] = [
          Falha na regressão do fixture "":,
            Total esperado:  | Total extraído: ,
            Divergências encontradas ( unidades):,
        ];

        for (const div of divergencias) {
          if (div.tipo === "ausente_no_recebido") {
            linhasRelatorio.push(    - Unidade []: AUSENTE na extração);
          } else if (div.tipo === "inesperada_no_recebido") {
            linhasRelatorio.push(    - Unidade []: INESPERADA (não consta no gabarito));
          } else if (div.tipo === "campo_divergente") {
            linhasRelatorio.push(    - Unidade []: divergência nos campos:);
            for (const d of div.detalhes || []) {
              linhasRelatorio.push(        * : esperado [], recebido []);
            }
          }
        }

        expect.fail(linhasRelatorio.join("\n"));
      }
    });
  }
});
