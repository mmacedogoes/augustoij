/**
 * Ponte entre os nomes usados na interface e as colunas reais da tabela `assembleias`.
 * A UI trabalha com `data_inicio`, `bloqueio_inadimplente`, etc.; o banco usa
 * `data_hora`, `bloqueia_inadimplente`, etc.
 */
export const MAPA_ASSEMBLEIA_UI_PARA_DB: Record<string, string> = {
  data_inicio: "data_hora",
  bloqueio_inadimplente: "bloqueia_inadimplente",
  limite_procuracoes: "limite_procuracoes_por_outorgado",
  voto_pela_mesa: "permite_voto_manual_mesa",
  quorum_instalacao_1: "quorum_instalacao_1a",
  quorum_instalacao_2: "quorum_instalacao_2a",
};

/** Colunas extras selecionadas com alias para manter o contrato da UI. */
export const SELECT_ASSEMBLEIA_ALIASES =
  "data_inicio:data_hora, bloqueio_inadimplente:bloqueia_inadimplente, limite_procuracoes:limite_procuracoes_por_outorgado, voto_pela_mesa:permite_voto_manual_mesa, quorum_instalacao_1:quorum_instalacao_1a, quorum_instalacao_2:quorum_instalacao_2a";

/** Valores aceitos pelas constraints do banco. */
const VALORES_TIPO: Record<string, string> = {
  AGO: "ago",
  AGE: "age",
  MISTA: "mista",
};

const VALORES_BASE_CALCULO: Record<string, string> = {
  voto_por_unidade: "unidade",
  unidade: "unidade",
  fracao_ideal: "fracao_ideal",
};

/** Quóruns são armazenados como fração numérica (0 a 1). */
const VALORES_QUORUM: Record<string, number> = {
  maioria_unidades: 0.5,
  metade_mais_um: 0.5,
  dois_tercos: 0.6667,
  qualquer_numero: 0,
};

function normalizarValor(chaveUi: string, valor: unknown): unknown {
  if (chaveUi === "tipo" && typeof valor === "string") {
    return VALORES_TIPO[valor] ?? valor.toLowerCase();
  }
  if (chaveUi === "base_calculo_padrao" && typeof valor === "string") {
    return VALORES_BASE_CALCULO[valor] ?? valor;
  }
  if (chaveUi === "quorum_instalacao_1" || chaveUi === "quorum_instalacao_2") {
    if (valor === null || valor === undefined || valor === "") return chaveUi === "quorum_instalacao_2" ? null : undefined;
    if (typeof valor === "number") return valor;
    if (typeof valor === "string") return VALORES_QUORUM[valor] ?? (Number(valor) || null);
  }
  return valor;
}

/** Converte um payload vindo da UI para nomes de coluna do banco. */
export function paraColunasDb<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const normalizado = normalizarValor(k, v);
    if (normalizado === undefined) continue;
    out[MAPA_ASSEMBLEIA_UI_PARA_DB[k] ?? k] = normalizado;
  }
  return out;
}

