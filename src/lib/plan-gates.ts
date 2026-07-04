/**
 * Helpers puros de gate por plano — usados no cliente e no servidor.
 * Fonte única de verdade: src/config/plans.ts.
 *
 * IMPORTANTE: todo bloqueio deve ser aplicado ao mesmo tempo no servidor
 * (server function) e no cliente (UI). Estes helpers padronizam as
 * mensagens para não haver textos divergentes espalhados pelo app.
 */
import { PLANS, type Plan, type PlanId, type PlanRecursos } from "@/config/plans";

export type FeatureKey = keyof PlanRecursos;

export function resolvePlanId(raw: string | null | undefined): PlanId {
  if (raw && raw in PLANS) return raw as PlanId;
  return "gratuito";
}

export function getPlan(planoId: PlanId): Plan {
  return PLANS[planoId];
}

export function hasFeature(planoId: PlanId, key: FeatureKey): boolean {
  return PLANS[planoId].recursos[key] === true;
}

/** Mensagens padrão de upgrade — reaproveitadas em UI e erros de API. */
export const gateMessages = {
  uploadDesabilitado: (planoNome: string) =>
    `O upload de documentos não está disponível no plano ${planoNome}. Faça upgrade para enviar documentos.`,
  documentosMax: (planoNome: string, max: number) =>
    `Você atingiu o limite de ${max} documento${max === 1 ? "" : "s"} do plano ${planoNome}. Faça upgrade para enviar mais documentos.`,
  analiseContratos: () =>
    "A análise de contratos está disponível a partir do plano Essencial.",
  condominiosMax: (planoNome: string, max: number) =>
    `Seu plano ${planoNome} permite até ${max} condomínio${max === 1 ? "" : "s"}. Faça upgrade para adicionar mais.`,
  usuariosMax: (planoNome: string, max: number) =>
    `Seu plano ${planoNome} permite até ${max} usuário${max === 1 ? "" : "s"}. Faça upgrade para adicionar mais.`,
  historicoLimitado: (planoNome: string, dias: number) =>
    `Histórico disponível por ${dias} dias no plano ${planoNome}. Faça upgrade para acessar conversas anteriores.`,
  minutasBloqueadas: () => "Disponível no plano Profissional.",
  relatoriosBloqueados: () =>
    "Relatórios por condomínio estão disponíveis a partir do plano Profissional.",
  trialExpirado: () =>
    "Seu período gratuito encerrou. Escolha um plano para continuar.",
} as const;

/**
 * Diretiva a ser adicionada ao system prompt quando o plano do usuário
 * NÃO inclui jurisprudência completa. O modelo continua respondendo,
 * mas sem citar acórdãos.
 */
export function jurisprudenciaDirective(planoId: PlanId): string | null {
  if (hasFeature(planoId, "jurisprudenciaCompleta")) return null;
  const nome = PLANS[planoId].nome;
  return `\nRESTRIÇÃO DE PLANO: O usuário está no plano ${nome}. NÃO inclua citações de jurisprudência ou referências a acórdãos (STJ, STF, TJ) nas respostas. Responda com base na legislação vigente (Código Civil, Lei 4.591/64) e em orientações gerais, sem mencionar precedentes específicos.\n`;
}

/** true quando o trial do plano gratuito acabou. */
export function isTrialExpired(planoId: PlanId, trialEndIso: string | null): boolean {
  if (planoId !== "gratuito" || !trialEndIso) return false;
  return new Date(trialEndIso).getTime() <= Date.now();
}