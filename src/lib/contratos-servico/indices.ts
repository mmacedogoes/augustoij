/**
 * Motor de índices do BCB para o módulo de contratos de prestação de serviços.
 *
 * Reaproveita o padrão de consulta do módulo de imóveis (SGS: IGP-M 189,
 * IPCA 433, INPC 188) com cache em memória de 12 h para evitar chamadas
 * repetidas à API pública. Nunca lança em falha de rede: retorna `erro`
 * preenchido para a UI abrir em modo manual.
 */

export const SERIES_BCB_CONTRATOS = {
  IGPM: 189,
  IPCA: 433,
  INPC: 188,
} as const;

export type IndiceContrato = "igpm" | "ipca" | "inpc";

type Ponto = { ano: number; mes: number; valor: number };
type CacheEntry = { at: number; pontos: Ponto[]; erro: string | null };

const CACHE_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function parseBcbData(s: string): { ano: number; mes: number } {
  const [d, m, y] = s.split("/").map((n) => Number(n));
  return { ano: y, mes: m };
}

/** Consulta 12 meses de uma série SGS terminando em anoFim/mesFim (inclusive). */
export async function fetchSerieMensal(args: {
  serie: number;
  anoIni: number;
  mesIni: number;
  anoFim: number;
  mesFim: number;
}): Promise<{ pontos: Ponto[]; erro: string | null }> {
  const key = `${args.serie}:${args.anoIni}-${args.mesIni}:${args.anoFim}-${args.mesFim}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return { pontos: hit.pontos, erro: hit.erro };
  }
  const dIni = `${pad2(1)}/${pad2(args.mesIni)}/${args.anoIni}`;
  const dFim = `${pad2(ultimoDiaMes(args.anoFim, args.mesFim))}/${pad2(args.mesFim)}/${args.anoFim}`;
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${args.serie}/dados?formato=json&dataInicial=${dIni}&dataFinal=${dFim}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BCB HTTP ${res.status}`);
    const raw = (await res.json()) as Array<{ data: string; valor: string }>;
    const pontos: Ponto[] = [];
    for (const r of raw) {
      const { ano, mes } = parseBcbData(r.data);
      const valor = Number(r.valor.replace(",", "."));
      if (Number.isFinite(valor)) pontos.push({ ano, mes, valor });
    }
    cache.set(key, { at: Date.now(), pontos, erro: null });
    return { pontos, erro: null };
  } catch (e) {
    const erro = (e as Error).message;
    // Não faz cache de erro — permite retry rápido.
    return { pontos: [], erro };
  }
}

/** Produto composto: (1 + v1/100) × (1 + v2/100) … − 1, em %. */
export function acumularComposto(pontos: Array<{ valor: number }>): number {
  let acc = 1;
  for (const p of pontos) acc *= 1 + Number(p.valor) / 100;
  return (acc - 1) * 100;
}

function serieDoIndice(i: IndiceContrato): number {
  switch (i) {
    case "igpm": return SERIES_BCB_CONTRATOS.IGPM;
    case "ipca": return SERIES_BCB_CONTRATOS.IPCA;
    case "inpc": return SERIES_BCB_CONTRATOS.INPC;
  }
}

export function rotuloIndiceContrato(i: string | null | undefined): string {
  switch (i) {
    case "igpm": return "IGP-M";
    case "ipca": return "IPCA";
    case "inpc": return "INPC";
    case "outro": return "Outro";
    case "nenhum": return "Não há";
    default: return "—";
  }
}

export type SugestaoIndice = {
  indiceContratual: IndiceContrato | "outro" | "nenhum";
  indiceSugerido: IndiceContrato | null;
  acumuladoContratual: number | null;
  acumuladoSugerido: number | null;
  substituicaoPorNegativo: boolean;
  erroApi: string | null;
  janela: { anoIni: number; mesIni: number; anoFim: number; mesFim: number };
};

/**
 * Calcula o índice acumulado em 12 meses fechados anteriores ao mesBase do
 * ano corrente (ou do próximo, se o mesBase ainda não chegou este ano).
 * Se o índice contratual é IGP-M e o acumulado ficar negativo, sugere IPCA
 * no lugar, mantendo o contratual como referência.
 */
export async function calcularIndiceParaReajuste(args: {
  indiceContratual: string; // igpm | ipca | inpc | outro | nenhum
  mesBase: number;          // 1..12
  anoReferencia?: number;   // opcional (default: ano corrente Brasília)
}): Promise<SugestaoIndice> {
  const contratual = args.indiceContratual as SugestaoIndice["indiceContratual"];
  const anoRef =
    args.anoReferencia ??
    Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));
  // Janela: 12 meses fechados terminando no mês ANTERIOR ao mesBase.
  let anoFim = anoRef;
  let mesFim = args.mesBase - 1;
  if (mesFim < 1) { mesFim = 12; anoFim -= 1; }
  let anoIni = anoFim;
  let mesIni = mesFim - 11;
  while (mesIni < 1) { mesIni += 12; anoIni -= 1; }
  const janela = { anoIni, mesIni, anoFim, mesFim };

  if (contratual === "outro" || contratual === "nenhum") {
    return {
      indiceContratual: contratual,
      indiceSugerido: null,
      acumuladoContratual: null,
      acumuladoSugerido: null,
      substituicaoPorNegativo: false,
      erroApi: null,
      janela,
    };
  }

  const base = await fetchSerieMensal({ serie: serieDoIndice(contratual), ...janela });
  if (base.erro) {
    return {
      indiceContratual: contratual,
      indiceSugerido: contratual,
      acumuladoContratual: null,
      acumuladoSugerido: null,
      substituicaoPorNegativo: false,
      erroApi: base.erro,
      janela,
    };
  }
  const acumContratual = acumularComposto(base.pontos);
  if (contratual === "igpm" && acumContratual < 0) {
    const ipca = await fetchSerieMensal({ serie: SERIES_BCB_CONTRATOS.IPCA, ...janela });
    const acumIpca = ipca.erro ? null : acumularComposto(ipca.pontos);
    return {
      indiceContratual: contratual,
      indiceSugerido: "ipca",
      acumuladoContratual: acumContratual,
      acumuladoSugerido: acumIpca,
      substituicaoPorNegativo: true,
      erroApi: ipca.erro,
      janela,
    };
  }
  return {
    indiceContratual: contratual,
    indiceSugerido: contratual,
    acumuladoContratual: acumContratual,
    acumuladoSugerido: acumContratual,
    substituicaoPorNegativo: false,
    erroApi: null,
    janela,
  };
}

/** Arredonda com 2 casas em modo bancário simples (round-half-away-from-zero). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}