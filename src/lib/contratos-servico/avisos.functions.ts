/**
 * Interruptor "Avisos automáticos" da ficha do contrato (Fase 4).
 * Ao desligar, cancela automaticamente todos os eventos automáticos futuros pendentes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";
import { cancelarEventosAutomaticosFuturos, gerarEventosInterno } from "./eventos.functions";

const input = z.object({
  contratoId: z.string().uuid(),
  ativo: z.boolean(),
});

export const setAvisosAutomaticos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => input.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { error } = await context.supabase
      .from("contratos_servico")
      .update({ notificacoes_ativas: data.ativo } as never)
      .eq("id", data.contratoId);
    if (error) throw new Error(error.message);
    if (!data.ativo) {
      await cancelarEventosAutomaticosFuturos(context.supabase, data.contratoId);
    } else {
      try {
        await gerarEventosInterno(context.supabase, data.contratoId);
      } catch (e) {
        console.warn("[avisos] Falha ao regerar eventos:", e);
      }
    }
    return { ok: true as const };
  });