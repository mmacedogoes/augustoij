import { construirCenso, type ChunkCenso } from "../censo-linhas";
import { interpretarConvencaoDescritiva } from "../convencao-descritiva";
import { extrairUnidadesDeQuadros } from "../quadro-parser";
import { segmentarRegistros } from "./segmentador";
import { lerRegistro } from "./rotulos";

export type UnidadeEsperadaFormatada = {
  escopo: string | null;
  numero: string;
  area_privativa: number | null;
  fracao_ideal: number | null;
};

export type ResultadoExtracaoFormatado = {
  total: number;
  unidades: UnidadeEsperadaFormatada[];
};

function quebrarTextoEmChunksSinteticos(texto: string, documentoId = "fixture-doc"): ChunkCenso[] {
  const regexPagina = /(?:^|\n)(?:---\s*\n##\s*P[aá]gina\s+(\d+)|\[P[aá]gina\s+(\d+)\])/i;
  
  if (regexPagina.test(texto)) {
    const partes = texto.split(/(?=(?:^|\n)(?:---\s*\n##\s*P[aá]gina\s+\d+|\[P[aá]gina\s+\d+\]))/i);
    return partes
      .map((conteudo, i) => {
        const pagMatch = /(?:P[aá]gina\s+(\d+))/i.exec(conteudo);
        const pagina = pagMatch ? Number(pagMatch[1]) : i + 1;
        return {
          id: `chunk-${i}`,
          conteudo: conteudo.trim(),
          metadata: {
            ordem_global: i,
            pagina_inicio: pagina,
            pagina_fim: pagina,
            trecho: i,
          },
        };
      })
      .filter((c) => c.conteudo.length > 0);
  }

  const linhas = texto.split("\n");
  const chunks: ChunkCenso[] = [];
  let buffer: string[] = [];
  let chunkIdx = 0;

  for (let i = 0; i < linhas.length; i++) {
    buffer.push(linhas[i]);
    if (buffer.length >= 60 || (buffer.length >= 30 && linhas[i].trim() === "")) {
      chunks.push({
        id: `chunk-${chunkIdx}`,
        conteudo: buffer.join("\n"),
        metadata: {
          ordem_global: chunkIdx,
          pagina_inicio: chunkIdx + 1,
          pagina_fim: chunkIdx + 1,
          trecho: chunkIdx,
        },
      });
      buffer = [];
      chunkIdx++;
    }
  }

  if (buffer.length > 0) {
    chunks.push({
      id: `chunk-${chunkIdx}`,
      conteudo: buffer.join("\n"),
      metadata: {
        ordem_global: chunkIdx,
        pagina_inicio: chunkIdx + 1,
        pagina_fim: chunkIdx + 1,
        trecho: chunkIdx,
      },
    });
  }

  return chunks;
}

export function extrairUnidadesDoTexto(texto: string): ResultadoExtracaoFormatado {
  const paginas = [{ numero: 1, texto }];
  const registros = segmentarRegistros(paginas, "fixture-doc");
  const descritiva = interpretarConvencaoDescritiva(texto, registros.length);
  if (descritiva.ok && descritiva.unidades.length > 0) {
    const unidades: UnidadeEsperadaFormatada[] = descritiva.unidades.map((u) => ({
      escopo: u.bloco ?? null,
      numero: u.numero,
      area_privativa: u.area_privativa ?? u.area_terreno ?? null,
      fracao_ideal: u.fracao_ideal ?? null,
    }));

    unidades.sort((a, b) => {
      const cmpBloco = (a.escopo || "").localeCompare(b.escopo || "");
      if (cmpBloco !== 0) return cmpBloco;
      return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
    });

    return {
      total: unidades.length,
      unidades,
    };
  }

  if (registros.length > 0) {
    const candidatas: UnidadeEsperadaFormatada[] = [];
    for (const reg of registros) {
      if (reg.motivo_descarte === "identidade_repetida_no_documento") continue;
      const medidas = lerRegistro(reg.texto);
      let area: number | null = null;
      let fracao: number | null = null;
      for (const m of medidas) {
        if (
          (m.campo === "area_privativa" || m.campo === "area_terreno" || m.campo === "area_generica") &&
          area == null
        ) {
          area = m.valor_numerico;
        }
        if (m.campo === "fracao_ideal" && fracao == null) {
          fracao = m.valor_numerico;
        }
      }
      candidatas.push({
        escopo: reg.escopo ?? null,
        numero: reg.sufixo ? `${reg.numero}${reg.sufixo}` : reg.numero,
        area_privativa: area,
        fracao_ideal: fracao,
      });
    }

    const comMedidas = candidatas.filter((u) => u.area_privativa != null || u.fracao_ideal != null);
    if (comMedidas.length >= 0.5 * candidatas.length) {
      candidatas.sort((a, b) => {
        const cmpBloco = (a.escopo || "").localeCompare(b.escopo || "");
        if (cmpBloco !== 0) return cmpBloco;
        return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
      });
      return {
        total: candidatas.length,
        unidades: candidatas,
      };
    }
  }

  const chunks = quebrarTextoEmChunksSinteticos(texto);
  const censo = construirCenso("fixture-doc", chunks);
  const resultadoQuadro = extrairUnidadesDeQuadros(censo);

  if (resultadoQuadro.unidades.length > 0) {
    const unidades: UnidadeEsperadaFormatada[] = resultadoQuadro.unidades.map((u) => {
      const areaMedida = u.medidas?.find((m) => m.campo === "area_privativa" || m.campo === "area_global");
      const fracaoMedida = u.medidas?.find(
        (m) =>
          m.campo === "fracao_terreno" ||
          m.campo === "coeficiente_rateio" ||
          m.campo === "fracao_coisas_comuns"
      );

      let areaPrivativa: number | null = null;
      if (areaMedida) {
        const limpo = areaMedida.valor_bruto.replace(/\./g, "").replace(",", ".");
        const n = Number(limpo);
        if (Number.isFinite(n)) areaPrivativa = n;
      }

      let fracaoIdeal: number | null = null;
      if (fracaoMedida) {
        const limpo = fracaoMedida.valor_bruto.replace(/\./g, "").replace(",", ".");
        const n = Number(limpo);
        if (Number.isFinite(n)) {
          fracaoIdeal =
            fracaoMedida.escala === "percentual" || fracaoMedida.valor_bruto.includes("%")
              ? n / 100
              : n;
        }
      }

      return {
        escopo: u.bloco ?? null,
        numero: u.numero,
        area_privativa: areaPrivativa,
        fracao_ideal: fracaoIdeal,
      };
    });

    unidades.sort((a, b) => {
      const cmpBloco = (a.escopo || "").localeCompare(b.escopo || "");
      if (cmpBloco !== 0) return cmpBloco;
      return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
    });

    return {
      total: unidades.length,
      unidades,
    };
  }

  return {
    total: 0,
    unidades: [],
  };
}