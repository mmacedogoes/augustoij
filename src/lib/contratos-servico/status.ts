/**
 * Helper puro para calcular o status de exibição de um contrato de serviço.
 * Reutilizado na listagem, nos contadores e nos badges.
 */
export type StatusExibicaoContrato =
  | "encerrado"
  | "suspenso"
  | "vigente"
  | "vence_em_breve"
  | "vencido";

export type ContratoStatusInput = {
  situacao: string | null | undefined;
  prazo_indeterminado: boolean | null | undefined;
  data_fim: string | Date | null | undefined;
};

/** Janela em dias para "vence em breve". */
export const JANELA_VENCIMENTO_DIAS = 90;

export function statusExibicaoContrato(c: ContratoStatusInput): StatusExibicaoContrato {
  if (c.situacao === "encerrado") return "encerrado";
  if (c.situacao === "suspenso") return "suspenso";
  // O banco pode retornar 'ativo' para contratos vigentes em alguns contextos legados ou via API externa.
  if (c.situacao === "ativo") return "vigente";
  if (c.prazo_indeterminado) return "vigente";
  if (!c.data_fim) return "vigente";
  const fim = c.data_fim instanceof Date ? c.data_fim : new Date(String(c.data_fim));
  if (Number.isNaN(fim.getTime())) return "vigente";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = fim.getTime() - hoje.getTime();
  const diffDias = Math.floor(diffMs / 86_400_000);
  if (diffDias < 0) return "vencido";
  if (diffDias <= JANELA_VENCIMENTO_DIAS) return "vence_em_breve";
  return "vigente";
}

export function rotuloStatus(s: StatusExibicaoContrato): string {
  switch (s) {
    case "vigente":
      return "Vigente";
    case "vence_em_breve":
      return "Vence em breve";
    case "vencido":
      return "Vencido";
    case "suspenso":
      return "Suspenso";
    case "encerrado":
      return "Encerrado";
  }
}