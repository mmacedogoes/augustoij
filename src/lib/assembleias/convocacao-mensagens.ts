import { paraRomano } from "./romanos";

export interface DestinatarioContext {
  nome: string;
  unidade: string;
  email?: string | null;
  telefone?: string | null;
}

export interface AssembleiaContext {
  condominio_nome: string;
  tipo: string;
  data_inicio: string;
  local?: string | null;
  modalidade: string;
  convocacao_numero: number;
  codigo_publico: string;
  link_videoconferencia?: string | null;
}

export interface ItemPautaContext {
  ordem: number;
  titulo: string;
  descricao?: string | null;
  regra_quorum: string;
}

/**
 * Monta o texto para a mensagem de WhatsApp da convocação.
 * Respeita o limite de 900 caracteres.
 */
export function montarMensagemWhatsApp(
  assembleia: AssembleiaContext,
  itens: ItemPautaContext[],
  destinatario: DestinatarioContext,
  options: { incluirVotacao: boolean } = { incluirVotacao: false }
): string {
  const data = new Date(assembleia.data_inicio);
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });

  const modalidadeTexto = assembleia.modalidade === 'presencial' ? 'Presencial' : 
                         assembleia.modalidade === 'virtual' ? 'Virtual' : 'Híbrida';

  let msg = `*${assembleia.condominio_nome}*\n`;
  msg += `*CONVOCAÇÃO: ASSEMBLEIA ${assembleia.tipo.toUpperCase()}*\n\n`;
  msg += `Prezado(a) ${destinatario.nome} (${destinatario.unidade}),\n\n`;
  msg += `Convocamos V.S.ª para a assembleia que será realizada em *${dataFormatada}* (${diaSemana}), às *${horaFormatada}* em ${assembleia.convocacao_numero}ª convocação.\n\n`;
  msg += `📍 *Local:* ${assembleia.local || 'Não informado'}\n`;
  msg += `💻 *Modalidade:* ${modalidadeTexto}\n\n`;
  
  msg += `*Ordem do Dia:*\n`;
  itens.forEach(item => {
    msg += `${paraRomano(item.ordem)}. ${item.titulo}\n`;
  });
  msg += `\n`;

  const baseUrl = `https://augustoij.com.br`; // Usar o domínio do projeto
  msg += `📄 *Edital completo:* ${baseUrl}/e/${assembleia.codigo_publico}\n`;

  if (assembleia.link_videoconferencia && (assembleia.modalidade === 'virtual' || assembleia.modalidade === 'hibrida')) {
    msg += `🎥 *Sala Virtual:* ${assembleia.link_videoconferencia}\n`;
  }

  if (options.incluirVotacao) {
    // Apenas reservado para Fase 6
    // msg += `🗳️ *Votação:* ${baseUrl}/v/${assembleia.codigo_publico}\n`;
  }

  // Validação de limite
  if (msg.length > 900) {
    // Tenta encurtar removendo descrições ou limitando itens se necessário
    // Mas a instrução pede bloqueio na UI, aqui apenas retornamos
  }

  return msg;
}

/**
 * Escapa caracteres HTML para uso em templates.
 */
export function escapeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
