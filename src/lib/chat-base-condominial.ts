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