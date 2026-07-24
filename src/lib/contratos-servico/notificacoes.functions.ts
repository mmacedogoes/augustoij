/**
 * Central de notificações no aplicativo (Fase 4).
 *
 * Estas funções são as ÚNICAS do módulo que NÃO exigem super-admin:
 * qualquer usuário autenticado acessa apenas as próprias notificações,
 * garantido também via RLS em `public.notificacoes` (user_id = auth.uid()).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().nullable().optional(),
});

export type NotificacaoLinha = {
  id: string;
  titulo: string;
  mensagem: string | null;
  categoria: string;
  url_destino: string | null;
  contrato_id: string | null;
  evento_id: string | null;
  lida_em: string | null;
  created_at: string;
};

export const listNotificacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listInput.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, categoria, url_destino, contrato_id, evento_id, lida_em, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as NotificacaoLinha[];
    const nextCursor = list.length === data.limit ? list[list.length - 1].created_at : null;
    return { rows: list, nextCursor };
  });

export const contarNaoLidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const marcarNotificacaoLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const marcarTodasLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });