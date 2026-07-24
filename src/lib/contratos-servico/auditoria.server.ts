/**
 * Trilha de auditoria do módulo de Contratos de Prestação de Serviços.
 *
 * Grava em `public.contrato_auditoria` via service_role (a tabela é apenas
 * legível por super-admin; escrita fica no backend). Nunca lança: uma
 * falha na trilha não deve reverter a operação de negócio.
 */
export type AuditoriaAcao =
  | "contrato.criar"
  | "contrato.criar_importacao"
  | "contrato.editar"
  | "contrato.excluir"
  | "obrigacao.criar"
  | "obrigacao.editar"
  | "obrigacao.remover"
  | "checklist.gerar"
  | "checklist.marcar"
  | "reajuste.aplicar"
  | "reajuste.desfazer"
  | "reajuste.dispensar"
  | "aditivo.registrar"
  | "aditivo.editar"
  | "aditivo.remover"
  | "contrato.encerrar"
  | "contrato.reabrir"
  | "contrato.suspender"
  | "contrato.retomar"
  | "responsavel.alterar"
  | "avisos.alterar";

export type AuditoriaEntrada = {
  contratoId: string | null;
  condominioId?: string | null;
  acao: AuditoriaAcao;
  descricao: string;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  userId?: string | null;
};

export async function registrarAuditoriaContrato(e: AuditoriaEntrada): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contrato_auditoria").insert({
      contrato_id: e.contratoId,
      condominio_id: e.condominioId ?? null,
      acao: e.acao,
      descricao: e.descricao,
      dados_anteriores: (e.dadosAnteriores ?? null) as never,
      dados_novos: (e.dadosNovos ?? null) as never,
      user_id: e.userId ?? null,
    });
    if (error) console.error("[auditoria-contrato]", e.acao, error.message);
  } catch (err) {
    console.error("[auditoria-contrato] exceção", e.acao, err);
  }
}