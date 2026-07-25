/**
 * Consulta da linha do tempo de atividades de um contrato.
 * As marcações de checklist são agrupadas por período+checklist em
 * uma única linha resumida para não poluir a linha do tempo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";

type LinhaAuditoria = {
  id: string;
  acao: string;
  descricao: string;
  created_at: string;
  user_id: string | null;
  autor_nome: string | null;
  autor_email: string | null;
};

export const listAuditoriaContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    const { data: rows, error } = await context.supabase
      .from("contrato_auditoria")
      .select("id, acao, descricao, created_at, user_id")
      .eq("contrato_id", data.contratoId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(((rows ?? []) as { user_id: string | null }[]).map((r) => r.user_id).filter(Boolean) as string[]),
    );
    let byId: Record<string, { nome: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      byId = Object.fromEntries(
        (profs ?? []).map((p) => [p.id, { nome: p.nome ?? null, email: p.email ?? null }]),
      );
    }

    const linhas: LinhaAuditoria[] = ((rows ?? []) as Array<{
      id: string; acao: string; descricao: string; created_at: string; user_id: string | null;
    }>).map((r) => ({
      id: r.id,
      acao: r.acao,
      descricao: r.descricao,
      created_at: r.created_at,
      user_id: r.user_id,
      autor_nome: r.user_id ? byId[r.user_id]?.nome ?? null : null,
      autor_email: r.user_id ? byId[r.user_id]?.email ?? null : null,
    }));

    return { rows: linhas };
  });

export type { LinhaAuditoria };