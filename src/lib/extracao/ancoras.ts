export type AncoraReconhecida = {
  numero: string;
  sufixo: string | null;
  padrao: string;
  ancora: string;
  numeros?: string[];
  tipo?: "grupo" | "singular";
};

export const RE_ANCORA_GRUPO =
  /(?:As\s+|Os\s+)?(?:unidades\s+aut[oôó]nomas|apartamentos|casas|lotes|salas|lojas)\s*(?:[a-zç]+\s+)?(?:\([^)]*\)\s*)?de\s+n[º°o\.]*s?[^\p{L}\p{N}\n]*((?:[*_]*\d{1,5}[*_]*\s*(?:,|\se\s)\s*)+[*_]*\d{1,5}[*_]*)/iu;

export const RE_ANCORA_SINGULAR =
  /\b(?:A\s+)?unidade\s+aut[oôó]noma\s+(?:[a-zç]+\s+)?(?:\([^)]*\)\s*)?de\s+n[º°o]s?\.?\s*(\d{1,5})\s*,?\s*(?:possui|possuem|com\s|contendo)/i;

export function expandirListaDeNumeros(lista: string): string[] {
  return lista
    .replace(/[*_]/g, "")
    .split(/\s*(?:,|\se\s)\s*/)
    .map((s) => s.trim())
    .filter((s) => /^\d{1,5}$/.test(s));
}

const NUM = "(?<![\\d.])(\\d{1,3}(?:\\.\\d{3})+|\\d{1,5})(?!\\d)";
const SUF = "(?:\\s*[-–—]?\\s*([A-Z])\\b)?";
const ancora = (nome: string, substantivo: string, lacuna: number) => ({
  nome,
  re: new RegExp(
    `(?<!\\d+\\s*\\([^)]*\\)\\s*)(?<![\\p{L}\\p{N}])(?:${substantivo})(?![\\p{L}\\p{N}])(?!(?:[^\\d\\n]*(?:vinculad|destin|localizad|passad|correspond)))[^\\d\\n]{0,${lacuna}}${NUM}${SUF}`,
    "iu",
  ),
});

export type PadraoAncoraDef = {
  nome: string;
  re: RegExp;
  tipo?: "grupo" | "singular";
};

export const PADROES_ANCORA: PadraoAncoraDef[] = [
  { nome: "grupo_unidades", re: RE_ANCORA_GRUPO, tipo: "grupo" },
  { nome: "unidade_autonoma_singular", re: RE_ANCORA_SINGULAR, tipo: "singular" },
  ancora("unidade_autonoma", "unidade\\s+aut[oôó]noma|garagem\\s+aut[oôó]noma", 40),
  ancora("apartamento",      "APARTAMENTO|APTO|AP", 30),
  ancora("lote",             "lote", 30),
  ancora("casa",             "casa", 30),
  ancora("sala_loja",        "sala|loja|conjunto|cj", 30),
  { nome: "celula_tabela", re: /^\s*\|?\s*(\d{1,5})(?:\s*[-–—]?\s*([A-Z]))?\s*\|/m },
];

export const REGEX_ESCOPO_GLOBAL =
  /(?<!\b(?:da|do|das|dos)\s+)\b(?:BLOCO|TORRE|QUADRA|QD|SETOR)\s*[:.\-–—]*\s*(?!DE\b|DO\b|DA\b|DOS\b|DAS\b)([A-Z0-9]{1,4})\b/iu;

export const PADROES_ESCOPO = REGEX_ESCOPO_GLOBAL;

/**
 * Reconhece cabeçalho de escopo (bloco/torre/quadra/etc.) no texto.
 * Devolve o identificador do escopo (ex: "A", "03", "12") ou null.
 */
export function reconhecerEscopo(linha: string): string | null {
  const m = REGEX_ESCOPO_GLOBAL.exec(linha.trim());
  if (m && m[1]) {
    return m[1].toUpperCase();
  }
  return null;
}

/**
 * Testa a linha contra PADROES_ANCORA na ordem estrita e para no primeiro que casar.
 * O sufixo só é aceito se for uma letra isolada.
 * A guarda normativa inspeciona apenas os 60 caracteres anteriores ao casamento.
 */
export function reconhecerAncora(linha: string): AncoraReconhecida | null {
  for (const padrao of PADROES_ANCORA) {
    const m = padrao.re.exec(linha);
    if (m) {
      // Guarda normativa (Defeito 0.2): olha apenas os 60 caracteres antes da âncora
      const contextoAntes = linha.slice(Math.max(0, m.index - 60), m.index);
      if (/(?:art(?:igo|\.)|par[aá]grafo|cl[aá]usula|§)\s*(?:n[º°o.]\s*)?$/i.test(contextoAntes.trim())) {
        continue;
      }
      if (padrao.tipo === "grupo") {
        const numeros = expandirListaDeNumeros(m[1]);
        return {
          numero: numeros[0] ?? m[1],
          sufixo: null,
          padrao: padrao.nome,
          ancora: m[0],
          numeros,
          tipo: "grupo",
        };
      }
      const numero = m[1].replace(/\./g, "");
      const sufixo = m[2] ? m[2].toUpperCase() : null;
      return {
        numero,
        sufixo,
        padrao: padrao.nome,
        ancora: m[0],
        tipo: padrao.tipo ?? "singular",
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