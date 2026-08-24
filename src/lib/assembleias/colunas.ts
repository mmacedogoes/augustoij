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

/** Converte um payload vindo da UI para nomes de coluna do banco. */
export function paraColunasDb<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    out[MAPA_ASSEMBLEIA_UI_PARA_DB[k] ?? k] = v;
  }
  return out;
}
