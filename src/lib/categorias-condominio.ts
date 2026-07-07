/**
 * Metadados das categorias de condomínio suportadas.
 * Alterar este arquivo propaga vocabulário para toda a UI e para o prompt da IA.
 */

export type CategoriaCondominio =
  | "predio"
  | "casas"
  | "salas_comerciais"
  | "shopping"
  | "galpoes";

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
    vocabIA:
      'Este condomínio é um PRÉDIO/EDIFÍCIO DE APARTAMENTOS. Use "bloco" para o bloco/torre (ex: A, B, Torre 1) e "numero" para o apartamento (ex: 101, 202). Tipo padrão: "apartamento".',
  },
  {
    id: "casas",
    label: "Condomínio de casas / lotes",
    descricaoCurta: "Casas ou lotes distribuídos em quadras",
    vocab: { bloco: "Quadra", numero: "Lote", unidade: "Lote", tipoPadrao: "lote" },
    vocabIA:
      'Este condomínio é de CASAS/LOTES organizados por QUADRAS. Use "bloco" para a QUADRA (ex: Q1, Quadra A) e "numero" para o LOTE/CASA (ex: 001, 042). Tipo padrão: "lote" (ou "casa" se a convenção especificar casas construídas, "terreno" se explicitar terrenos sem edificação). REGRA IMPORTANTE DE DISTRIBUIÇÃO: se a convenção declarar "N quadras e M lotes" (ex: "36 quadras e 662 lotes"), SEMPRE distribua os lotes entre as quadras — não devolva apenas os lotes sem quadra. Se a divisão exata por quadra não constar, distribua uniformemente (M/N lotes por quadra, arredondando as sobras nas primeiras quadras) e nomeie as quadras como Q1..QN.',
  },
  {
    id: "salas_comerciais",
    label: "Salas comerciais / lojas",
    descricaoCurta: "Edifício comercial de salas ou lojas",
    vocab: { bloco: "Andar", numero: "Sala", unidade: "Sala", tipoPadrao: "sala_comercial" },
    vocabIA:
      'Este condomínio é COMERCIAL, com SALAS/LOJAS. Use "bloco" para o ANDAR/PAVIMENTO (ex: 3, T, M) e "numero" para a sala/loja (ex: 301, 302). Tipo padrão: "sala_comercial" (ou "loja" no térreo).',
  },
  {
    id: "shopping",
    label: "Shopping center",
    descricaoCurta: "Shopping com lojas e quiosques",
    vocab: { bloco: "Piso", numero: "Loja", unidade: "Loja", tipoPadrao: "loja" },
    vocabIA:
      'Este condomínio é um SHOPPING CENTER. Use "bloco" para o PISO (ex: L1, L2, Térreo) e "numero" para a LOJA/quiosque (ex: 101, K05). Tipo padrão: "loja".',
  },
  {
    id: "galpoes",
    label: "Galpões / logística",
    descricaoCurta: "Condomínio logístico de galpões",
    vocab: { bloco: "Setor", numero: "Galpão", unidade: "Galpão", tipoPadrao: "galpao" },
    vocabIA:
      'Este condomínio é LOGÍSTICO/INDUSTRIAL, com GALPÕES. Use "bloco" para o SETOR/MÓDULO (ex: A, B) e "numero" para o GALPÃO (ex: G01, G02). Tipo padrão: "galpao".',
  },
];

const MAP: Record<CategoriaCondominio, CategoriaMeta> = Object.fromEntries(
  CATEGORIAS_CONDOMINIO.map((c) => [c.id, c]),
) as Record<CategoriaCondominio, CategoriaMeta>;

export function normalizeCategoria(raw: string | null | undefined): CategoriaCondominio {
  if (raw && raw in MAP) return raw as CategoriaCondominio;
  return "predio";
}

export function getCategoriaMeta(raw: string | null | undefined): CategoriaMeta {
  return MAP[normalizeCategoria(raw)];
}
