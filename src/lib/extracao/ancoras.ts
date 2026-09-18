export type AncoraReconhecida = {
  numero: string;
  sufixo: string | null;
  padrao: string;
  ancora: string;
};

const NUM = "(?<![\\d.])(\\d{1,3}(?:\\.\\d{3})+|\\d{1,5})(?!\\d)";
const SUF = "(?:\\s*[-–—]?\\s*([A-Z])\\b)?";
const ancora = (nome: string, substantivo: string, lacuna: number) => ({
  nome,
  re: new RegExp(`\\b(?:${substantivo})\\b[^\\d\\n]{0,${lacuna}}${NUM}${SUF}`, "i"),
});

export const PADROES_ANCORA = [
  ancora("unidade_autonoma", "unidade\\s+aut[oôó]noma|garagem\\s+aut[oôó]noma", 40),
  ancora("apartamento",      "APARTAMENTO|APTO|AP", 30),
  ancora("lote",             "lote", 30),
  ancora("casa",             "casa", 30),
  ancora("sala_loja",        "sala|loja|conjunto|cj", 30),
  { nome: "celula_tabela", re: /^\s*\|?\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?\s*\|/m },
];

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
 * O sufixo só é aceito se for uma letra isolada.
 */
export function reconhecerAncora(linha: string): AncoraReconhecida | null {
  if (/^\s*(?:art(?:igo|\.)|par[aá]grafo|cl[aá]usula)\b/i.test(linha)) {
    return null;
  }
  for (const padrao of PADROES_ANCORA) {
    const m = padrao.re.exec(linha);
    if (m) {
      const numero = m[1].replace(/\./g, "");
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