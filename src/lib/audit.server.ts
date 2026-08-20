/**
 * Helper centralizado de auditoria administrativa.
 *
 * Regras:
 * - SEMPRE grava via `supabaseAdmin` (bypass RLS). A tabela `admin_audit_log`
 *   só possui política de SELECT para admins; inserções via `context.supabase`
 *   falhavam silenciosamente antes desta refatoração.
 * - Captura IP + User-Agent do request atual quando disponível.
 * - Falha soft: um erro na trilha de auditoria NÃO deve abortar a ação de
 *   negócio já concluída — apenas registra no console.
 */
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type AuditAction =
  | "user.create"
  | "user.activate"
  | "user.deactivate"
  | "role.set"
  | "subscription.update"
  | "kb.create"
  | "kb.delete"
  | "kb.process"
  | "orientacao.create"
  | "orientacao.update"
  | "orientacao.delete"
  | "despesa.create"
  | "despesa.delete"
  | "config_alertas.update"
  | "privacidade.exclusao_solicitada"
  | "privacidade.exclusao_confirmada"
  | "assembleia.create"
  | "assembleia.update"
  | "assembleia.cancel"
  | "assembleia.pauta.update"
  | "assembleia.edital.publicar"
  | "assembleia.convocacao.montar"
  | "assembleia.convocacao.enviar_email"
  | "assembleia.convocacao.whatsapp_link"
  | "assembleia.convocacao.whatsapp_confirmar"
  | "assembleia.convocacao.entrega_fisica";


export type AuditEntry = {
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string | null;
  targetCondominioId?: string | null;
  targetKbId?: string | null;
  metadata?: Record<string, unknown>;
};

function getAuditContext(): { ip: string | null; ua: string | null } {
  let ip: string | null = null;
  let ua: string | null = null;
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    /* fora de um request (SSR/prerender) */
  }
  try {
    ua = getRequestHeader("user-agent") ?? null;
  } catch {
    /* idem */
  }
  return { ip, ua };
}

/**
 * Registra uma ação administrativa. Não lança em caso de falha — um problema
 * na trilha não deve reverter a operação de negócio já concluída.
 */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ip, ua } = getAuditContext();
    const { error } = await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_condominio_id: entry.targetCondominioId ?? null,
      target_kb_id: entry.targetKbId ?? null,
      metadata: (entry.metadata ?? {}) as never,
      ip_address: ip,
      user_agent: ua,
    });
    if (error) {
      console.error("[audit]", entry.action, error.message);
    }
  } catch (e) {
    console.error("[audit] falha ao registrar", entry.action, e);
  }
}