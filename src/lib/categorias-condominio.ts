/**
 * Metadados das categorias de condomínio suportadas.
 * Alterar este arquivo propaga vocabulário para toda a UI e para o prompt da IA.
 */

export type CategoriaCondominio =
  | "predio"
  | "casas"
  | "casas_lotes"
  | "salas_comerciais"
  | "shopping"
  | "galpoes"
  | "misto";

export type TipoUnidadePadrao =
  | "apartamento"
  | "casa"
  | "lote"
  | "terreno"
  | "sala_comercial"
  | "loja"
  | "galpao"
  | "outro";

export type CategoriaMeta = {
  id: CategoriaCondominio;
  label: string;
  descricaoCurta: string;
  vocab: {
    bloco: string;
    numero: string;
    unidade: string;
    tipoPadrao: TipoUnidadePadrao;
  };
  /** Vocabulário injetado no prompt da IA para guiar a extração. */
  vocabIA: string;
};

export const CATEGORIAS_CONDOMINIO: CategoriaMeta[] = [
  {
    id: "predio",
    label: "Prédio / apartamentos",
    descricaoCurta: "Edifício residencial com apartamentos",
    vocab: { bloco: "Bloco", numero: "Número", unidade: "Unidade", tipoPadrao: "apartamento" },
    vocabIA: "",
  },
  {
    id: "casas",
    label: "Condomínio de casas / lotes",
    descricaoCurta: "Casas ou lotes distribuídos em quadras",
    vocab: { bloco: "Quadra", numero: "Lote", unidade: "Lote", tipoPadrao: "lote" },
    vocabIA: "",
  },
  {
    id: "casas_lotes",
    label: "Condomínio de casas / lotes",
    descricaoCurta: "Casas ou lotes distribuídos em quadras",
    vocab: { bloco: "Quadra", numero: "Lote", unidade: "Lote", tipoPadrao: "lote" },
    vocabIA: "",
  },
  {
    id: "salas_comerciais",
    label: "Salas comerciais / lojas",
    descricaoCurta: "Edifício comercial de salas ou lojas",
    vocab: { bloco: "Andar", numero: "Sala", unidade: "Sala", tipoPadrao: "sala_comercial" },
    vocabIA: "",
  },
  {
    id: "shopping",
    label: "Shopping center",
    descricaoCurta: "Shopping com lojas e quiosques",
    vocab: { bloco: "Piso", numero: "Loja", unidade: "Loja", tipoPadrao: "loja" },
    vocabIA: "",
  },
  {
    id: "galpoes",
    label: "Galpões / logística",
    descricaoCurta: "Condomínio logístico de galpões",
    vocab: { bloco: "Setor", numero: "Galpão", unidade: "Galpão", tipoPadrao: "galpao" },
    vocabIA: "",
  },
  {
    id: "misto",
    label: "Uso misto (residencial e comercial)",
    descricaoCurta: "Condomínio com apartamentos, lojas e salas",
    vocab: { bloco: "Bloco/Setor", numero: "Unidade", unidade: "Unidade", tipoPadrao: "outro" },
    vocabIA: "",
  },
];

const MAP: Record<CategoriaCondominio, CategoriaMeta> = Object.fromEntries(
  CATEGORIAS_CONDOMINIO.map((c) => [c.id, c]),
) as Record<CategoriaCondominio, CategoriaMeta>;

export function normalizeCategoria(raw: string | null | undefined): CategoriaCondominio {
  if (raw === "casas_lotes") return "casas";
  if (raw && raw in MAP) return raw as CategoriaCondominio;
  return "predio";
}

export function getCategoriaMeta(raw: string | null | undefined): CategoriaMeta {
  const norm = normalizeCategoria(raw);
  return MAP[norm] ?? MAP.predio;
}
