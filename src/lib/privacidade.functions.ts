import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAdminAction } from "./audit.server";

function readIp(): string | null {
  try {
    const req = getRequest();
    const xff = req?.headers.get("x-forwarded-for") ?? req?.headers.get("cf-connecting-ip");
    if (!xff) return null;
    return xff.split(",")[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Registra o aceite dos Termos de Uso + Política de Privacidade e o opt-in de marketing. */
export const registrarAceiteTermos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      versao: z.string().min(1).max(40),
      marketingOptIn: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ip = readIp();
    const { error } = await context.supabase
      .from("profiles")
      .update({
        termos_aceitos_em: new Date().toISOString(),
        termos_versao: data.versao,
        termos_ip: ip,
        marketing_opt_in: data.marketingOptIn,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Retorna a preferência atual de marketing do titular. */
export const getPreferenciaMarketing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("marketing_opt_in")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { marketingOptIn: Boolean(data?.marketing_opt_in) };
  });

/** Atualiza a preferência de marketing (opt-in / opt-out). */
export const atualizarMarketingOptIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ optIn: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ marketing_opt_in: data.optIn })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra uma solicitação de exportação dos dados do titular (LGPD art. 18, II). */
export const solicitarExportacaoDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("solicitacoes_exportacao")
      .insert({ user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Registra o pedido de exclusão e devolve o token para envio no e-mail de confirmação. */
export const solicitarExclusaoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ip = readIp();
    const { data, error } = await context.supabase
      .from("solicitacoes_exclusao_conta")
      .insert({ user_id: context.userId, ip })
      .select("token_confirmacao")
      .single();
    if (error) throw new Error(error.message);
    // Registro no log de auditoria interno
    await logAdminAction({
      actorUserId: context.userId,
      action: "privacidade.exclusao_solicitada",
      targetUserId: context.userId,
      metadata: { ip },
    });
    return { ok: true, token: data.token_confirmacao as string };
  });

/** Confirma a exclusão via token: marca a conta para exclusão em 30 dias e suspende agora. */
export const confirmarExclusaoConta = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pedido, error: findErr } = await supabaseAdmin
      .from("solicitacoes_exclusao_conta")
      .select("id, user_id, status")
      .eq("token_confirmacao", data.token)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!pedido) throw new Error("Token inválido ou expirado.");
    if (pedido.status === "confirmada" || pedido.status === "executada") {
      return { ok: true, ja: true };
    }
    const agora = new Date();
    const excluirEm = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { error: updErr } = await supabaseAdmin
      .from("solicitacoes_exclusao_conta")
      .update({
        status: "confirmada",
        confirmado_em: agora.toISOString(),
        suspende_em: agora.toISOString(),
        excluir_em: excluirEm.toISOString(),
      })
      .eq("id", pedido.id);
    if (updErr) throw new Error(updErr.message);
    await logAdminAction({
      actorUserId: pedido.user_id,
      action: "privacidade.exclusao_confirmada",
      targetUserId: pedido.user_id,
      metadata: { excluir_em: excluirEm.toISOString() },
    });
    return { ok: true, ja: false };
  });