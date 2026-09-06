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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export interface AvisoPrevioInfo {
  temAvisoPrevio: boolean;
  dataLimiteAviso: string | null;
  diasRestantesAviso: number | null;
  diasAvisoConfigurados: number;
  emJanelaCritica: boolean;
  expirado: boolean;
  textoFormatado: string;
}

export function calcularAvisoPrevioInfo(c: {
  data_fim?: string | null;
  aviso_previo_dias?: number | null;
  renovacao_automatica?: boolean | null;
  prazo_indeterminado?: boolean | null;
  situacao?: string | null;
}): AvisoPrevioInfo {
  if (c.prazo_indeterminado || !c.data_fim || c.situacao === "encerrado" || c.situacao === "suspenso") {
    return {
      temAvisoPrevio: false,
      dataLimiteAviso: null,
      diasRestantesAviso: null,
      diasAvisoConfigurados: Number(c.aviso_previo_dias ?? 30),
      emJanelaCritica: false,
      expirado: false,
      textoFormatado: "Não se aplica (prazo indeterminado ou inativo)",
    };
  }

  const diasAviso = Number(c.aviso_previo_dias && c.aviso_previo_dias > 0 ? c.aviso_previo_dias : 30);
  const dataFim = new Date(String(c.data_fim));
  if (Number.isNaN(dataFim.getTime())) {
    return {
      temAvisoPrevio: false,
      dataLimiteAviso: null,
      diasRestantesAviso: null,
      diasAvisoConfigurados: diasAviso,
      emJanelaCritica: false,
      expirado: false,
      textoFormatado: "Data de término inválida",
    };
  }

  // Data limite = data_fim - diasAviso
  const dataLimite = new Date(dataFim.getTime() - (diasAviso * 86_400_000));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diffDias = Math.ceil((dataLimite.getTime() - hoje.getTime()) / 86_400_000);
  const dataLimiteISO = dataLimite.toISOString().slice(0, 10);

  let textoFormatado = "";
  if (diffDias < 0) {
    textoFormatado = `Prazo de aviso expirado há ${Math.abs(diffDias)} dias (${formatarDataBR(dataLimiteISO)})`;
  } else if (diffDias === 0) {
    textoFormatado = "Último dia para notificar aviso prévio hoje!";
  } else if (diffDias === 1) {
    textoFormatado = `Aviso prévio limite vence amanhã (${formatarDataBR(dataLimiteISO)})`;
  } else {
    textoFormatado = `Notificar até ${formatarDataBR(dataLimiteISO)} (em ${diffDias} dias)`;
  }

  return {
    temAvisoPrevio: true,
    dataLimiteAviso: dataLimiteISO,
    diasRestantesAviso: diffDias,
    diasAvisoConfigurados: diasAviso,
    emJanelaCritica: diffDias <= 30 && diffDias >= 0,
    expirado: diffDias < 0,
    textoFormatado,
  };
}

export interface ReajusteStatusInfo {
  status: "em_dia" | "pendente" | "proximo_30d" | "sem_indice" | "nao_configurado";
  rotulo: string;
  mesBaseNome: string;
  indiceNome: string;
  descricao: string;
  badgeTone: "positive" | "warning" | "destructive" | "muted";
}

export function calcularReajusteStatusInfo(c: {
  mes_base_reajuste?: number | null;
  indice_reajuste?: string | null;
  ultimo_reajuste_em?: string | null;
  situacao?: string | null;
}): ReajusteStatusInfo {
  if (c.situacao === "encerrado" || c.situacao === "suspenso") {
    return {
      status: "nao_configurado",
      rotulo: "Inativo",
      mesBaseNome: "—",
      indiceNome: "—",
      descricao: "Contrato inativo",
      badgeTone: "muted",
    };
  }

  const indice = c.indice_reajuste?.toLowerCase() ?? "nenhum";
  const indiceNome = rotuloIndiceNome(indice);

  if (indice === "nenhum") {
    return {
      status: "sem_indice",
      rotulo: "Sem índice",
      mesBaseNome: c.mes_base_reajuste ? (MESES[c.mes_base_reajuste - 1] ?? "—") : "—",
      indiceNome: "Nenhum",
      descricao: "Não possui índice de reajuste estipulado",
      badgeTone: "muted",
    };
  }

  if (!c.mes_base_reajuste) {
    return {
      status: "nao_configurado",
      rotulo: "Mês-base ausente",
      mesBaseNome: "Não informado",
      indiceNome,
      descricao: "Mês-base de reajuste não foi cadastrado",
      badgeTone: "warning",
    };
  }

  const mesBase = c.mes_base_reajuste;
  const mesBaseNome = MESES[mesBase - 1] ?? `Mês ${mesBase}`;

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1; // 1-12
  const anoAtual = hoje.getFullYear();

  // Verifica se o último reajuste foi aplicado no ano corrente
  if (c.ultimo_reajuste_em) {
    const ultimoReajuste = new Date(String(c.ultimo_reajuste_em));
    if (!Number.isNaN(ultimoReajuste.getTime())) {
      const anoUltimo = ultimoReajuste.getFullYear();
      if (anoUltimo >= anoAtual) {
        return {
          status: "em_dia",
          rotulo: "Em dia",
          mesBaseNome,
          indiceNome,
          descricao: `Reajustado em ${ultimoReajuste.toLocaleDateString("pt-BR")}`,
          badgeTone: "positive",
        };
      }
    }
  }

  if (mesAtual === mesBase) {
    return {
      status: "pendente",
      rotulo: "Reajuste do mês",
      mesBaseNome,
      indiceNome,
      descricao: `Mês-base atual (${mesBaseNome}). Aplicar reajuste pelo ${indiceNome}.`,
      badgeTone: "destructive",
    };
  }

  if (mesAtual > mesBase) {
    return {
      status: "pendente",
      rotulo: "Reajuste pendente",
      mesBaseNome,
      indiceNome,
      descricao: `Mês-base (${mesBaseNome}) já transcorreu neste ano sem registro de reajuste.`,
      badgeTone: "destructive",
    };
  }

  if (mesBase === mesAtual + 1) {
    return {
      status: "proximo_30d",
      rotulo: "Reajuste em breve",
      mesBaseNome,
      indiceNome,
      descricao: `Reajuste previsto para o próximo mês (${mesBaseNome}) pelo ${indiceNome}.`,
      badgeTone: "warning",
    };
  }

  return {
    status: "em_dia",
    rotulo: "Previsto",
    mesBaseNome,
    indiceNome,
    descricao: `Próximo reajuste previsto para ${mesBaseNome}/${anoAtual} (${indiceNome}).`,
    badgeTone: "muted",
  };
}

function rotuloIndiceNome(i?: string | null): string {
  switch (i) {
    case "igpm": return "IGP-M";
    case "ipca": return "IPCA";
    case "inpc": return "INPC";
    case "outro": return "Outro";
    case "nenhum": return "Sem índice";
    default: return "—";
  }
}

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}