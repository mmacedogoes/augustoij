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

/**
 * Retorna o plano "efetivo" — quando `cortesia = true`, o usuário
 * é tratado como Personalizado (sem qualquer limite), independentemente
 * do plano marcado. O plano cru continua disponível para exibição.
 */
export function efetivoPlanoId(planoId: PlanId, cortesia: boolean): PlanId {
  return cortesia ? "personalizado" : planoId;
}

export function getPlan(planoId: PlanId): Plan {
  return PLANS[planoId];
}

export function hasFeature(planoId: PlanId, key: FeatureKey): boolean {
  return PLANS[planoId].recursos[key] === true;
}

/** Ordem canônica dos planos pagos (mais barato → mais completo). */
export const PLANOS_ORDEM: PlanId[] = [
  "gratuito",
  "essencial",
  "profissional",
  "gestao",
  "administradora",
  "personalizado",
];

/** Retorna o primeiro plano na ordem que desbloqueia a feature (ou null). */
export function primeiroPlanoComFeature(feature: FeatureKey): Plan | null {
  for (const id of PLANOS_ORDEM) {
    if (PLANS[id].recursos[feature]) return PLANS[id];
  }
  return null;
}

/** Lista de planos (após o atual, na ordem) que desbloqueiam a feature. */
export function planosQueDesbloqueiam(
  planoAtual: PlanId,
  feature: FeatureKey,
): Plan[] {
  const idxAtual = PLANOS_ORDEM.indexOf(planoAtual);
  return PLANOS_ORDEM
    .slice(idxAtual + 1)
    .filter((id) => PLANS[id].recursos[feature])
    .map((id) => PLANS[id]);
}

/** Mensagens padrão de upgrade — reaproveitadas em UI e erros de API. */
export const gateMessages = {
  uploadDesabilitado: (planoNome: string) =>
    `O upload de documentos não está disponível no plano ${planoNome}. Faça upgrade para enviar documentos.`,
  documentosMax: (planoNome: string, max: number) =>
    `Você atingiu o limite de ${max} documento${max === 1 ? "" : "s"} do plano ${planoNome}. Faça upgrade para enviar mais documentos.`,
  uploadGratuitoConvencao: () =>
    "No período gratuito você pode enviar 1 Convenção para testar. Para enviar mais documentos, escolha um plano.",
  uploadGratuitoContrato: () =>
    "No período gratuito você pode enviar 1 Contrato para testar. Para enviar mais documentos e ativar a gestão contínua, escolha um plano.",
  uploadGratuitoBloqueado: () =>
    "No período gratuito, o upload é limitado a 1 Convenção e 1 Contrato para você experimentar. Escolha um plano para enviar os demais documentos.",
  analiseContratos: () =>
    "A análise de contratos está disponível a partir do plano Essencial.",
  analiseGratuitoConsumida: () =>
    "No período gratuito você tem 1 análise completa de contrato para testar. Escolha um plano para rodar novas análises.",
  gestaoContinuaBloqueadaGratuito: () =>
    "A gestão contínua de contratos (agenda, checklists, alertas) está disponível a partir do plano Essencial.",
  contratosGestaoAtivaMax: (planoNome: string, max: number) =>
    `Seu plano ${planoNome} permite até ${max} contrato${max === 1 ? "" : "s"} em gestão ativa. Encerre um contrato ou faça upgrade para ativar mais.`,
  painelConsolidadoBloqueado: () =>
    "O painel consolidado da carteira está disponível a partir do plano Gestão.",
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
 * Jurisprudência NÃO é mais restrita por plano — todos os planos têm acesso
 * completo. A função é mantida (e sempre retorna null) para preservar os
 * pontos de chamada existentes no prompt do chat.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function jurisprudenciaDirective(_planoId: PlanId): string | null {
  return null;
}

/** true quando o trial do plano gratuito acabou. */
export function isTrialExpired(planoId: PlanId, trialEndIso: string | null): boolean {
  if (planoId !== "gratuito" || !trialEndIso) return false;
  return new Date(trialEndIso).getTime() <= Date.now();
}