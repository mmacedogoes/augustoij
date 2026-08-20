import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/contratos-servico/guard";

// Helper de Guard para todas as funções de servidor de Assembleias
export async function ensureAcessoAssembleias(context: { supabase: any; userId: string }): Promise<void> {
  const isSuper = await isSuperAdmin(context);
  if (!isSuper) throw new Error("Acesso negado: apenas Super Admin pode gerenciar assembleias.");
}
