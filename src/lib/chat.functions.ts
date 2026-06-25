import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("conversas")
      .select("id, titulo, created_at")
      .eq("condominio_id", data.condominioId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversas")
      .insert({ condominio_id: data.condominioId, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("mensagens")
      .select("id, papel, conteudo, created_at")
      .eq("conversa_id", data.conversaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("conversas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });