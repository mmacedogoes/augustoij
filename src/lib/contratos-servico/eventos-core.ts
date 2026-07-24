/**
 * Núcleo puro da agenda de eventos automáticos de contratos de serviço.
 *
 * Regras determinísticas baseadas em datas de Brasília. Sem I/O.
 * As datas usam sempre strings YYYY-MM-DD (fuso America/Sao_Paulo)
 * para evitar deslocamento por UTC ao serializar Date.
 */

export type TipoEvento =
  | "fim_vigencia"
  | "janela_denuncia"
  | "reajuste"
  | "pagamento"
  | "checklist_pendente"
  | "manual";

export type ContratoParaEventos = {
  id: string;
  prestador_nome: string;
  situacao: string;
  notificacoes_ativas: boolean;
  prazo_indeterminado: boolean;
  data_fim: string | null;
  data_inicio: string | null;
  renovacao_automatica: boolean;
  aviso_previo_dias: number | null;
  indice_reajuste: string | null;
  mes_base_reajuste: number | null;
  dia_vencimento: number | null;
  tipo_valor: string;
};

export type EventoAutomatico = {
  tipo: TipoEvento;
  titulo: string;
  descricao: string;
  data_evento: string; // YYYY-MM-DD
  antecedencia_dias: number | null;
  competencia: string | null; // YYYY-MM-01
};

// ---------------------------------------------------------- helpers de data BR

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data "hoje" em Brasília, no formato YYYY-MM-DD. */
export function hojeBR(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Adiciona/subtrai dias a uma data YYYY-MM-DD; retorna outra YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Último dia do mês (1-12) em ano dado, retorna número. */
export function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(Date.UTC(ano, mes1a12, 0)).getUTCDate();
}

/** Retorna YYYY-MM-DD para o dia D do mês/ano; se D não existe, usa último dia. */
export function dataDoMes(ano: number, mes1a12: number, dia: number): string {
  const ultimo = ultimoDiaDoMes(ano, mes1a12);
  const d = Math.min(Math.max(dia, 1), ultimo);
  return `${ano}-${pad(mes1a12)}-${pad(d)}`;
}

/** Primeiro dia do mês YYYY-MM-01. */
export function primeiroDiaDoMes(ano: number, mes1a12: number): string {
  return `${ano}-${pad(mes1a12)}-01`;
}

/** Compara duas datas ISO como strings — funciona porque estão no formato ISO. */
export function isFuturoOuHoje(iso: string, hoje: string): boolean {
  return iso >= hoje;
}

function proximaOcorrenciaMesBase(hoje: string, mesBase: number): { ano: number; mes: number } {
  const [ay, am] = hoje.split("-").map((n) => Number(n));
  const ano = am <= mesBase ? ay : ay + 1;
  return { ano, mes: mesBase };
}

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function rotuloIndice(i: string | null): string {
  switch (i) {
    case "igpm": return "IGP-M";
    case "ipca": return "IPCA";
    case "inpc": return "INPC";
    case "outro": return "outro índice";
    default: return "índice contratual";
  }
}

// ------------------------------------------------------------ geração de eventos

/**
 * Gera a lista determinística de eventos automáticos para um contrato.
 * Contratos inativos (encerrado/suspenso) ou com avisos desligados
 * retornam lista vazia — quem consumir cuida do cancelamento.
 */
export function gerarEventosPrevistos(c: ContratoParaEventos, hoje: string): EventoAutomatico[] {
  if (c.situacao !== "ativo" || !c.notificacoes_ativas) return [];
  const out: EventoAutomatico[] = [];

  // --- fim de vigência
  if (!c.prazo_indeterminado && c.data_fim) {
    const fim = c.data_fim;
    for (const dias of [90, 60, 30, 7]) {
      const data = addDaysISO(fim, -dias);
      if (!isFuturoOuHoje(data, hoje)) continue;
      out.push({
        tipo: "fim_vigencia",
        titulo: `Contrato vence em ${dias} dias`,
        descricao: `O contrato com ${c.prestador_nome} tem vigência até ${formatDataBR(fim)}.`,
        data_evento: data,
        antecedencia_dias: dias,
        competencia: null,
      });
    }
  }

  // --- janela de denúncia
  if (c.renovacao_automatica && !c.prazo_indeterminado && c.data_fim && c.aviso_previo_dias && c.aviso_previo_dias > 0) {
    const data = addDaysISO(c.data_fim, -(c.aviso_previo_dias + 15));
    const limite = addDaysISO(c.data_fim, -c.aviso_previo_dias);
    if (isFuturoOuHoje(data, hoje)) {
      out.push({
        tipo: "janela_denuncia",
        titulo: "Prazo para denunciar a renovação automática",
        descricao: `Sem manifestação até ${formatDataBR(limite)}, o contrato com ${c.prestador_nome} será renovado automaticamente.`,
        data_evento: data,
        antecedencia_dias: 15,
        competencia: null,
      });
    }
  }

  // --- reajuste
  if (c.indice_reajuste && c.indice_reajuste !== "nenhum" && c.mes_base_reajuste) {
    const { ano, mes } = proximaOcorrenciaMesBase(hoje, c.mes_base_reajuste);
    const dataBase = primeiroDiaDoMes(ano, mes);
    for (const dias of [30, 0]) {
      const data = addDaysISO(dataBase, -dias);
      if (!isFuturoOuHoje(data, hoje)) continue;
      out.push({
        tipo: "reajuste",
        titulo: "Reajuste contratual do mês",
        descricao: `Reajuste do contrato com ${c.prestador_nome} pelo índice ${rotuloIndice(c.indice_reajuste)}.`,
        data_evento: data,
        antecedencia_dias: dias,
        competencia: dataBase,
      });
    }
  }

  // --- pagamento mensal (próximos 12 meses)
  if (c.dia_vencimento && c.tipo_valor === "mensal") {
    const [hy, hm] = hoje.split("-").map((n) => Number(n));
    const limite = c.data_fim ?? null;
    for (let i = 0; i < 12; i++) {
      const ano = hy + Math.floor((hm - 1 + i) / 12);
      const mes = ((hm - 1 + i) % 12) + 1;
      const competencia = primeiroDiaDoMes(ano, mes);
      const vencimento = dataDoMes(ano, mes, c.dia_vencimento);
      const data = addDaysISO(vencimento, -5);
      if (!isFuturoOuHoje(data, hoje)) continue;
      if (limite && vencimento > limite) continue;
      out.push({
        tipo: "pagamento",
        titulo: "Pagamento do contrato vence em breve",
        descricao: `Vencimento em ${formatDataBR(vencimento)} — ${c.prestador_nome}.`,
        data_evento: data,
        antecedencia_dias: 5,
        competencia,
      });
    }
  }

  return out;
}

export function etiquetaTipoEvento(tipo: TipoEvento): string {
  switch (tipo) {
    case "fim_vigencia": return "Vigência";
    case "janela_denuncia": return "Renovação";
    case "reajuste": return "Reajuste";
    case "pagamento": return "Pagamento";
    case "checklist_pendente": return "Checklist";
    case "manual": return "Lembrete";
  }
}

export { formatDataBR };