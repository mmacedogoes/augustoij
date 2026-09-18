export type AncoraReconhecida = {
  numero: string;
  sufixo: string | null;
  padrao: string;
  ancora: string;
};

export const PADROES_ANCORA = [
  {
    nome: "apartamento_de_n",
    re: /\b(?:APARTAMENTO|APTO?|AP)\.?\s*(?:DE\s*)?N?[º°o]?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "unidade_autonoma",
    re: /\bunidade\s+aut[oôó]noma\s+(?:de\s+)?n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "unidade_simples",
    re: /\b(?:unidade|unid)\.?\s*n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "lote",
    re: /\blote\s*n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "casa",
    re: /\bcasa\s*n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "sala_loja",
    re: /\b(?:sala|loja|conjunto|cj)\s*n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "box_vaga",
    re: /\b(?:box|vaga)\s*n?[º°o]?\.?\s*[:.\-–—]*\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])/i,
  },
  {
    nome: "celula_tabela",
    re: /^\s*\|?\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?(?![a-zA-Z0-9])\s*\|/,
  },
] as const;

export const PADROES_ESCOPO =
  /^\s*(?:BLOCO|TORRE|QUADRA|QD|SETOR|PISO|PAVIMENTO|ANDAR)\s*[:.\-–—]*\s*([A-Z0-9]{1,4})\b/i;

/**
 * Reconhece cabeçalho de escopo (bloco/torre/quadra/etc.) em uma linha.
 * Devolve o identificador do escopo (ex: "A", "03", "12") ou null.
 */
export function reconhecerEscopo(linha: string): string | null {
  const m = PADROES_ESCOPO.exec(linha.trim());
  if (m && m[1]) {
    return m[1].toUpperCase();
  }
  return null;
}

/**
 * Testa a linha contra PADROES_ANCORA na ordem estrita e para no primeiro que casar.
 * O sufixo só é aceito se for uma letra isolada (garantido pelo lookahead (?![a-zA-Z0-9])).
 */
export function reconhecerAncora(linha: string): AncoraReconhecida | null {
  for (const padrao of PADROES_ANCORA) {
    const m = padrao.re.exec(linha);
    if (m) {
      const numero = m[1];
      const sufixo = m[2] ? m[2].toUpperCase() : null;
      return {
        numero,
        sufixo,
        padrao: padrao.nome,
        ancora: m[0],
      };
    }
  }
  return null;
}

/**
 * Gera a chave de identidade canônica: `${escopo ?? ""}|${numero}${sufixo ?? ""}`.
 */
export function gerarChaveIdentidade(
  numero: string,
  sufixo: string | null = null,
  escopo: string | null = null,
): string {
  const idUnidade = sufixo ? `${numero}${sufixo}` : numero;
  return `${escopo ?? ""}|${idUnidade}`;
}