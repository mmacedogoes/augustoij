/**
 * src/lib/extracao/tipologia.ts
 *
 * Classificador determinístico de tipologia de condomínio por contagem de âncoras e termos textuais.
 */

import { reconhecerAncora } from "./ancoras";

export type TipologiaDetectada =
  | "predio"
  | "casas_lotes"
  | "salas_comerciais"
  | "shopping"
  | "galpoes"
  | "misto";

export type ResultadoTipologia = {
  tipologia: TipologiaDetectada;
  scores: Record<TipologiaDetectada, number>;
  contagemAncoras: {
    apartamento: number;
    lote: number;
    casa: number;
    sala: number;
    loja: number;
    galpao: number;
  };
};

const TERMOS_FORTES = {
  predio: /\b(?:edif[íi]cio\s+residencial|condom[íi]nio\s+edil[íi]cio\s+residencial)\b/gi,
  casas_lotes: /\b(?:condom[íi]nio\s+de\s+lotes?|loteamento\s+fechado|loteamento\s+comum|associa[çc][ãa]o\s+de\s+moradores|desmembramento|gleba)\b/gi,
  salas_comerciais: /\b(?:edif[íi]cio\s+comercial|condom[íi]nio\s+comercial|centro\s+empresarial)\b/gi,
  shopping: /\b(?:shopping(?:\s+center)?|pra[çc]a\s+de\s+alimenta[çc][ãa]o|área\s+bruta\s+loc[áa]vel)\b/gi,
  galpoes: /\b(?:condom[íi]nio\s+log[íi]stico|parque\s+log[íi]stico|complexo\s+industrial)\b/gi,
};

const TERMOS_GERAIS = {
  predio: [
    /\b(?:apartamentos?|aptos?)\b/gi,
    /\b(?:torre|pavimento|andar|cobertura|elevador|pilot[is]|subsolo|hall)\b/gi,
  ],
  casas_lotes: [
    /\b(?:lotes?|loteamentos?|quadras?|qd\.?)\b/gi,
    /\b(?:casas?\s+residenciais?|[áa]rea\s+(?:do\s+)?(?:lote|terreno|solo)|alinhamento|testada|recuo\s+frontal)\b/gi,
  ],
  salas_comerciais: [
    /\b(?:salas?\s+comercia(?:is|l)|conjuntos?\s+comercia(?:is|l)|consult[óo]rios?)\b/gi,
    /\b(?:sobrelojas?|escrit[óo]rios?)\b/gi,
  ],
  shopping: [
    /\b(?:quiosques?|lojas?\s+[âa]ncoras?|luc\b|abl\b|lojas?\s+sat[ée]lites?)\b/gi,
  ],
  galpoes: [
    /\b(?:galp[ãa]o|galp[õo]es|m[óo]dulos?\s+log[íi]sticos?|armaz[eé]ns?)\b/gi,
    /\b(?:docas?|p[eé]-direito|cross-docking|p[áa]tio\s+de\s+manobras?)\b/gi,
  ],
};

function contarOcorrencias(texto: string, regex: RegExp): number {
  regex.lastIndex = 0;
  let count = 0;
  while (regex.exec(texto) !== null) {
    count++;
  }
  return count;
}

/**
 * Classifica a tipologia da convenção a partir das páginas de texto por contagem de âncoras e termos.
 * Retorna: predio | casas_lotes | salas_comerciais | shopping | galpoes | misto
 */
export function detectarTipologia(
  paginas: { numero: number; texto: string }[] | string,
): TipologiaDetectada {
  const texto =
    typeof paginas === "string"
      ? paginas
      : paginas.map((p) => p.texto).join("\n");

  const contagemAncoras = {
    apartamento: 0,
    lote: 0,
    casa: 0,
    sala: 0,
    loja: 0,
    galpao: 0,
  };

  // 1. Contagem de âncoras linha a linha
  const linhas = texto.split(/\r?\n/);
  for (const linha of linhas) {
    const lTrim = linha.trim();
    if (!lTrim) continue;
    const ancora = reconhecerAncora(linha);
    if (ancora) {
      if (ancora.padrao === "apartamento_de_n") contagemAncoras.apartamento++;
      else if (ancora.padrao === "lote") contagemAncoras.lote++;
      else if (ancora.padrao === "casa") contagemAncoras.casa++;
      else if (ancora.padrao === "sala_loja") {
        if (/loja/i.test(lTrim)) contagemAncoras.loja++;
        else contagemAncoras.sala++;
      }
    }
    if (/\bgalp[ãa]o\b/i.test(lTrim)) {
      contagemAncoras.galpao++;
    }
  }

  // 2. Pontuação por categoria
  let scorePredio = contagemAncoras.apartamento * 8;
  let scoreCasasLotes = (contagemAncoras.lote + contagemAncoras.casa) * 8;
  let scoreSalas = contagemAncoras.sala * 8;
  let scoreShopping = contagemAncoras.loja * 6;
  let scoreGalpoes = contagemAncoras.galpao * 8;

  // Termos fortes (peso 5)
  scorePredio += contarOcorrencias(texto, TERMOS_FORTES.predio) * 5;
  scoreCasasLotes += contarOcorrencias(texto, TERMOS_FORTES.casas_lotes) * 5;
  scoreSalas += contarOcorrencias(texto, TERMOS_FORTES.salas_comerciais) * 5;
  scoreShopping += contarOcorrencias(texto, TERMOS_FORTES.shopping) * 5;
  scoreGalpoes += contarOcorrencias(texto, TERMOS_FORTES.galpoes) * 5;

  // Termos gerais (peso 1)
  for (const re of TERMOS_GERAIS.predio) scorePredio += contarOcorrencias(texto, re);
  for (const re of TERMOS_GERAIS.casas_lotes) scoreCasasLotes += contarOcorrencias(texto, re);
  for (const re of TERMOS_GERAIS.salas_comerciais) scoreSalas += contarOcorrencias(texto, re);
  for (const re of TERMOS_GERAIS.shopping) scoreShopping += contarOcorrencias(texto, re);
  for (const re of TERMOS_GERAIS.galpoes) scoreGalpoes += contarOcorrencias(texto, re);

  // 3. Regra de uso misto: coocorrência relevante de residencial e comercial
  const residencial = Math.max(scorePredio, scoreCasasLotes);
  const comercial = Math.max(scoreSalas, scoreShopping);
  if (residencial >= 20 && comercial >= 20) {
    const razao = Math.min(residencial, comercial) / Math.max(residencial, comercial);
    if (razao >= 0.3) {
      return "misto";
    }
  }

  // 4. Seleção da tipologia com maior pontuação
  const categorias: Array<{ tipo: TipologiaDetectada; score: number }> = [
    { tipo: "predio", score: scorePredio },
    { tipo: "casas_lotes", score: scoreCasasLotes },
    { tipo: "salas_comerciais", score: scoreSalas },
    { tipo: "shopping", score: scoreShopping },
    { tipo: "galpoes", score: scoreGalpoes },
  ];

  categorias.sort((a, b) => b.score - a.score);

  if (categorias[0].score === 0) {
    return "predio";
  }

  return categorias[0].tipo;
}