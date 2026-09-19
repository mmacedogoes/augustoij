/**
 * src/lib/extracao/quadro-nbr.ts
 *
 * Leitura de quadros de áreas e frações no padrão NBR 12.721.
 * Implementa validação de identidade por abertura de bloco, equivalências (02 == 2)
 * e grupos de unidades conforme Mudança 2.
 */

import { semAcento, normalizarNumeroUnidade, normalizarParte } from "../censo-linhas";
import { expandirIntervalos } from "./rotulos";
import { expandirListaDeNumeros, REGEX_ESCOPO_GLOBAL } from "./ancoras";

export type InfoAbertura = {
  linha: string;
  unidades: string[];
  escopo: string | null;
  tipo?: string;
  comRessalva?: boolean;
  motivoRessalva?: string;
};

export type OcorrenciaQuadro = {
  linhaTexto: string;
  pagina: number | null;
  abertura: InfoAbertura | null;
};

/**
 * Verifica se a linha abre um bloco de unidade/tipo no padrão NBR 12.721.
 * Regra 1: comece pela designação de uma unidade ou tipo.
 * Regra 2: confrontações ("limita-se com o apto...") nunca abrem bloco.
 */
export function reconhecerAberturaBloco(linha: string): InfoAbertura | null {
  const trim = linha.trim();
  if (!trim) return null;

  // Descarta linhas puras de tabela
  if (/^\s*\|.*\|\s*$/.test(trim) && !/^\s*\|\s*(?:apartamento|unidade|apto|loja|sala|lote|casa)\b/i.test(trim)) {
    return null;
  }

  // Remove marcações markdown no início e marcadores de lista como a), b), 1., 1.1)
  const limpa = trim
    .replace(/^[#*_\->\s]+/, "")
    .replace(/^(?:\(?[a-z0-9]+(?:\.[a-z0-9]+)*\)?|\d+\.)\s*[-–—.:]?\s*/i, "")
    .trim();

  // Regra 2: não pode conter verbos de confrontação ou não-abertura
  if (/\b(?:limita|confronta|vinculad|destinad|localizad|passad|correspond)\b/i.test(limpa)) {
    return null;
  }

  // Deve começar pela designação de unidade ou de tipo
  const RE_INICIO =
    /^(?:(?:As\s+|Os\s+|A\s+|O\s+)?(?:unidades?|apartamentos?|aptos?|casas?|lojas?|salas?|lotes?|vagas?|boxes?)(?:\s+aut[oôó]nomas?)?(?:\s+habitacionais?)?|tipo\s+[a-z0-9]+|apto\.?\s*\d+|apartamento\s*\d+|unidade\s*\d+|loja\s*\d+|sala\s*\d+|casa\s*\d+|lote\s*\d+|n[º°o.]*\s*\d+)/i;

  if (!RE_INICIO.test(limpa)) {
    return null;
  }

  // Verifica escopo (bloco/torre/quadra) presente na linha de abertura
  let escopo: string | null = null;
  const mEscopo = REGEX_ESCOPO_GLOBAL.exec(limpa);
  if (mEscopo && mEscopo[1]) {
    escopo = mEscopo[1].toUpperCase();
  }

  // Tipo puro (ex: "Tipo A", "Apartamento Tipo 1")
  const mTipo = /^tipo\s+([a-z0-9]+)/i.exec(limpa);
  if (mTipo) {
    return {
      linha: trim,
      unidades: [],
      escopo,
      tipo: `Tipo ${mTipo[1].toUpperCase()}`,
    };
  }

  // Verifica se há expressão por final e pavimento (Regra 5: ressalva)
  if (/fina(?:l|is)\s+\d+.*pavimento/i.test(limpa)) {
    const numeros = expandirListaDeNumeros(limpa);
    return {
      linha: trim,
      unidades: numeros,
      escopo,
      comRessalva: true,
      motivoRessalva: "expressão por final e pavimento",
    };
  }

  // Verifica intervalos (ex: "101 a 110", "101 a 104")
  const mIntervalo = /\b(\d{1,5})\s*(?:a|at[ée]|ao|[-–—])\s*(\d{1,5})\b/i.exec(limpa);
  if (mIntervalo) {
    const n1Str = mIntervalo[1];
    const n2Str = mIntervalo[2];
    const n1 = parseInt(n1Str, 10);
    const n2 = parseInt(n2Str, 10);

    // Verifica se é faixa no mesmo andar (mesmo comprimento e diferença <= 20)
    const mesmoAndar =
      n1Str.length === n2Str.length &&
      Math.abs(n2 - n1) <= 20 &&
      (n1Str.length <= 2 || n1Str.slice(0, -2) === n2Str.slice(0, -2) || n1Str.slice(0, -1) === n2Str.slice(0, -1));

    const expandidos = expandirIntervalos(`${n1Str} a ${n2Str}`);
    if (mesmoAndar) {
      return {
        linha: trim,
        unidades: expandidos,
        escopo,
        comRessalva: false,
      };
    } else {
      // Faixa que atravessa andares (Regra 5: ressalva)
      return {
        linha: trim,
        unidades: expandidos,
        escopo,
        comRessalva: true,
        motivoRessalva: "faixa atravessa andares",
      };
    }
  }

  // Lista explícita (ex: "unidades 101, 201 e 301")
  const lista = expandirListaDeNumeros(limpa);
  if (lista.length > 1) {
    return {
      linha: trim,
      unidades: lista,
      escopo,
      comRessalva: false,
    };
  }

  // Unidade única (ex: "Apartamento 02", "Unidade 2", "Loja 01", "02")
  const mUnico = /(?:n[º°o.]*\s*|de\s+n[º°o.]*\s*|^|\s)(\d{1,5})\s*([a-zA-Z])?\b/.exec(limpa);
  if (mUnico) {
    const num = mUnico[2] ? `${mUnico[1]}${mUnico[2].toUpperCase()}` : mUnico[1];
    return {
      linha: trim,
      unidades: [num],
      escopo,
    };
  }

  return null;
}

/**
 * Cria o índice de blocos do documento para validar identidade de linhas de quadro.
 */
export function construirIndiceQuadros(linhasDoc: Array<{ texto: string; pagina?: number | null; bloco_contexto?: string | null }>) {
  let aberturaAtual: InfoAbertura | null = null;
  let escopoAtual: string | null = null;
  const ocorrencias: OcorrenciaQuadro[] = [];
  const linhasQuadroSet = new Set<string>();

  for (const item of linhasDoc) {
    const txt = item.texto.trim();
    if (!txt) continue;

    // Atualiza escopo se a linha trouxer um bloco/torre
    const mEsc = REGEX_ESCOPO_GLOBAL.exec(txt);
    if (mEsc && mEsc[1]) {
      escopoAtual = mEsc[1].toUpperCase();
    }

    // Verifica se a linha abre um novo bloco
    const abertura = reconhecerAberturaBloco(txt);
    if (abertura) {
      aberturaAtual = {
        ...abertura,
        escopo: abertura.escopo ?? escopoAtual ?? item.bloco_contexto ?? null,
      };
      continue;
    }

    // Se for linha de tabela/quadro (contém pipe |)
    if (/\|/.test(txt)) {
      linhasQuadroSet.add(txt);
      ocorrencias.push({
        linhaTexto: txt,
        pagina: item.pagina ?? null,
        abertura: aberturaAtual,
      });
    }
  }

  return {
    linhasQuadro: linhasQuadroSet,
    ocorrencias,
    /**
     * Verifica se a medida de quadro confere com a unidade.
     * Regra 3: avalia todas as ocorrências da linha no documento.
     * Regra 4: equivalências "2", "02", "nº 2", etc.
     */
    conferirIdentidadeQuadro(
      trechoMedida: string,
      unidade: { numero: string; bloco?: string | null },
    ): {
      ok: boolean;
      motivo?: string;
      aberturaLinha?: string;
      comRessalva?: boolean;
      motivoRessalva?: string;
    } {
      const trechoLimpo = trechoMedida.trim();
      const trechoNorm = trechoMedida.replace(/\s+/g, " ").trim();
      const numNorm = normalizarNumeroUnidade(unidade.numero);
      const blocoNorm = normalizarParte(unidade.bloco ?? "");

      // Busca todas as ocorrências desta linha no documento (Regra 3)
      const matches = ocorrencias.filter((o) => {
        const oNorm = o.linhaTexto.replace(/\s+/g, " ").trim();
        return (
          o.linhaTexto === trechoLimpo ||
          o.linhaTexto.includes(trechoLimpo) ||
          trechoLimpo.includes(o.linhaTexto) ||
          oNorm === trechoNorm ||
          oNorm.includes(trechoNorm) ||
          trechoNorm.includes(oNorm)
        );
      });

      if (matches.length === 0) {
        return { ok: false, motivo: "quadro sem indicação da unidade" };
      }

      for (const o of matches) {
        if (!o.abertura) continue;

        // Se o bloco exigir conferência de escopo
        if (blocoNorm && o.abertura.escopo) {
          if (normalizarParte(o.abertura.escopo) !== blocoNorm) {
            continue;
          }
        }

        // Verifica se a abertura inclui a unidade
        for (const uNum of o.abertura.unidades) {
          if (normalizarNumeroUnidade(uNum) === numNorm) {
            return {
              ok: true,
              aberturaLinha: o.abertura.linha,
              comRessalva: o.abertura.comRessalva,
              motivoRessalva: o.abertura.motivoRessalva,
            };
          }
        }
      }

      return { ok: false, motivo: "identidade_nao_confere" };
    },
  };
}
