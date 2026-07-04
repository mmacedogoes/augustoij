/**
 * Helpers puros (sem side-effects) usados no cliente e no servidor
 * para calcular limites de mensagens com base em src/config/plans.ts.
 */
import { PLANS, type PlanId } from "@/config/plans";

export type UsoAtual = {
  planoId: PlanId;
  planoNome: string;
  /** Conta de cortesia (criada por admin) — bypass total de limites. */
  cortesia: boolean;
  /** Contador de mensagens do MÊS corrente (fuso America/Sao_Paulo). */
  mensagensMes: number;
  /** Contador de mensagens de HOJE (fuso America/Sao_Paulo). */
  mensagensDia: number;
  /** Limite mensal do plano; null = ilimitado. */
  limiteMes: number | null;
  /** Limite diário do plano; null = sem limite diário. */
  limiteDia: number | null;
  /** Data ISO do próximo reset mensal (primeiro dia do próximo mês, meia-noite SP). */
  resetMesIso: string;
  /** Fim do período de trial (para plano Gratuito). Pode ser null. */
  trialFimIso: string | null;
  /** Dias restantes de trial (arredondado para baixo, mínimo 0). */
  diasRestantesTrial: number | null;
  /** true quando o trial expirou (para plano Gratuito). */
  trialExpirado: boolean;
};

export type LimiteStatus =
  | { bloqueado: false }
  | {
      bloqueado: true;
      motivo: "diario" | "mensal" | "trial_expirado";
      /** Mensagem pronta para exibição inline no chat. */
      mensagem: string;
    };

function fmtDataBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function avaliarLimite(uso: UsoAtual): LimiteStatus {
  // Cortesia = admin liberou uso sem limites
  if (uso.cortesia) return { bloqueado: false };
  const plano = PLANS[uso.planoId];
  if (!plano) return { bloqueado: false };

  // Trial expirado → bloqueia mesmo se contador não bateu
  if (uso.trialExpirado) {
    return {
      bloqueado: true,
      motivo: "trial_expirado",
      mensagem:
        "Seu período gratuito encerrou. Escolha um plano para continuar usando o Augusto.",
    };
  }

  if (plano.mensagensPorDia !== null && uso.mensagensDia >= plano.mensagensPorDia) {
    return {
      bloqueado: true,
      motivo: "diario",
      mensagem: `Você usou suas ${plano.mensagensPorDia} mensagens de hoje. Volte amanhã ou faça upgrade para continuar agora.`,
    };
  }

  if (plano.mensagensPorMes !== null && uso.mensagensMes >= plano.mensagensPorMes) {
    return {
      bloqueado: true,
      motivo: "mensal",
      mensagem: `Você atingiu o limite de ${plano.mensagensPorMes} mensagens deste mês. Seu contador renova em ${fmtDataBR(uso.resetMesIso)}. Faça upgrade para continuar.`,
    };
  }

  return { bloqueado: false };
}

/** Modelo Lovable AI para o plano (nunca exibir na UI). */
export function modeloParaPlano(planoId: PlanId): string {
  const plano = PLANS[planoId];
  if (!plano) return "google/gemini-3-flash-preview";
  return plano.modelo_ia === "modelo-economico"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

/** Ordem dos planos para mostrar upgrades acima do atual. */
export const PLANOS_PAGOS_ORDENADOS: PlanId[] = [
  "essencial",
  "profissional",
  "gestao",
  "administradora",
  "personalizado",
];

export function proximosPlanos(atual: PlanId): PlanId[] {
  if (atual === "gratuito") return PLANOS_PAGOS_ORDENADOS;
  const idx = PLANOS_PAGOS_ORDENADOS.indexOf(atual);
  if (idx < 0) return PLANOS_PAGOS_ORDENADOS;
  return PLANOS_PAGOS_ORDENADOS.slice(idx + 1);
}