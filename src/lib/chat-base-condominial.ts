/**
 * Helpers puros para decisões de contexto condominial no endpoint de chat.
 * Extraídos de src/routes/api/chat.ts para permitir testes unitários.
 */

export type DocumentoTipo = { tipo: string };

export type BaseCondominial = {
  temConvencao: boolean;
  temRegimento: boolean;
  temBaseCondominial: boolean;
};

/**
 * Avalia se o condomínio possui convenção e/ou regimento prontos.
 * Espera receber apenas documentos já com `status_processamento = "pronto"`
 * (o filtro fica na query Supabase).
 */
export function avaliarBaseCondominial(
  docs: DocumentoTipo[] | null | undefined,
): BaseCondominial {
  const temConvencao = !!docs?.some((d) => d.tipo === "convencao");
  const temRegimento = !!docs?.some((d) => d.tipo === "regimento");
  return {
    temConvencao,
    temRegimento,
    temBaseCondominial: temConvencao || temRegimento,
  };
}

/**
 * Decide se o handler deve emitir a resposta estática pedindo upload
 * de convenção/regimento (short-circuit, sem chamar o modelo).
 */
export function deveSolicitarReupload(params: {
  temBaseCondominial: boolean;
  temMatchDocumento: boolean;
  temAnexoTemporario: boolean;
  perguntaNorm: string;
}): boolean {
  const { temBaseCondominial, temMatchDocumento, temAnexoTemporario, perguntaNorm } =
    params;
  return (
    !temBaseCondominial &&
    !temMatchDocumento &&
    !temAnexoTemporario &&
    perguntaNorm.length > 0
  );
}

export const AVISO_INTERNO_SEM_BASE =
  "AVISO INTERNO: este condomínio ainda não possui convenção nem regimento interno anexados. Ao final da resposta jurídica geral, peça de forma clara e cordial que o usuário anexe esses documentos na aba Documentos para respostas específicas ao caso concreto dele.\n\n";

export const FALLBACK_SEM_MATCH =
  "Nenhum trecho da convenção/regimento deste condomínio bateu com a pergunta — se a dúvida envolver regras internas específicas, avise o usuário e sugira revisar a redação da pergunta.\n\n";

/**
 * Monta o bloco de contexto condominial injetado no system prompt.
 * - contexto presente → usa o contexto real.
 * - sem contexto mas base pronta → aviso neutro de "nenhum trecho bateu".
 * - sem contexto e sem base → AVISO INTERNO pedindo upload.
 */
export function blocoContextoCondominial(params: {
  contexto: string;
  temBaseCondominial: boolean;
}): string {
  const { contexto, temBaseCondominial } = params;
  if (contexto) {
    return `CONTEXTO DOS DOCUMENTOS DO CONDOMÍNIO:\n\n${contexto}\n\n`;
  }
  return temBaseCondominial ? FALLBACK_SEM_MATCH : AVISO_INTERNO_SEM_BASE;
}

export type ChatMessageLike = {
  id?: string;
  role: "system" | "user" | "assistant" | "data" | string;
  content?: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
};

/**
 * Otimiza o histórico de mensagens para redução de tokens e aceleração de contexto (AAS Playbook):
 * - Em conversas curtas (<= 6 mensagens): mantém todas as mensagens intactas.
 * - Em conversas longas (> 6 mensagens):
 *   • Mantém 100% íntegras TODAS as mensagens do usuário (role: "user") para preservar a intenção.
 *   • Mantém 100% íntegras as últimas 4 mensagens da conversa (janela recente de contexto).
 *   • Comprime respostas intermediárias antigas do assistente (> 350 caracteres)
 *     em um resumo factual ancorado, evitando o reprocessamento de minutas repetidas.
 */
export function otimizarHistoricoMensagens<T extends ChatMessageLike>(messages: T[]): T[] {
  if (!messages || messages.length <= 6) return messages;

  const total = messages.length;
  const indiceCorteRecente = Math.max(0, total - 4);

  return messages.map((m, idx) => {
    // Preserva mensagens do usuário ou turnos recentes
    if (m.role === "user" || idx >= indiceCorteRecente) {
      return m;
    }

    // Extrai o texto do assistente
    let texto = "";
    if (Array.isArray(m.parts) && m.parts.length > 0) {
      texto = m.parts
        .map((p) => (p.type === "text" && typeof p.text === "string" ? p.text : ""))
        .join(" ")
        .trim();
    } else if (typeof m.content === "string") {
      texto = m.content.trim();
    }

    // Se já for concisa ou estruturada curta, mantém intacta
    if (texto.length <= 350) {
      return m;
    }

    const primeiraLinha = texto.split("\n")[0]?.slice(0, 70).replace(/[#*`]/g, "").trim() ?? "";
    const trechoResumo = texto.slice(0, 180).replace(/\n+/g, " ").replace(/[#*`]/g, "").trim();
    const textoComprimido = `[Registro consolidado da resposta anterior do assistente — ${primeiraLinha}: "${trechoResumo}…"]`;

    if (Array.isArray(m.parts) && m.parts.length > 0) {
      return {
        ...m,
        parts: [{ type: "text", text: textoComprimido }],
      };
    }

    return {
      ...m,
      content: textoComprimido,
    };
  });
}