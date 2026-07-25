/**
 * Responsáveis pelo contrato de serviço (Fase 4).
 * Regra de destinatário reutilizada pela rotina diária:
 *   - Se o contrato tiver responsáveis, são eles.
 *   - Caso contrário, o destinatário é `criado_por`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

const contratoInput = z.object({ contratoId: z.string().uuid() });
const paresInput = z.object({ contratoId: z.string().uuid(), userId: z.string().uuid() });

export type ResponsavelLinha = { user_id: string; nome: string | null; email: string | null };

export const listResponsaveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => contratoInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { data: rels, error } = await context.supabase
      .from("contrato_responsaveis")
      .select("user_id")
      .eq("contrato_id", data.contratoId);
    if (error) throw new Error(error.message);
    const ids = ((rels ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (ids.length === 0) return { rows: [] as ResponsavelLinha[] };
    const { data: profs, error: pErr } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    const rows: ResponsavelLinha[] = ((profs ?? []) as { id: string; nome: string | null; email: string | null }[])
      .map((p) => ({ user_id: p.id, nome: p.nome, email: p.email }))
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
    return { rows };
  });

export const listUsuariosElegiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAcessoContratos(context);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, nome, email")
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as { id: string; nome: string | null; email: string | null }[] };
  });

export const adicionarResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => paresInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { data: prof, error: pErr } = await context.supabase
      .from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof) throw new Error("Usuário não encontrado.");
    const { error } = await context.supabase
      .from("contrato_responsaveis")
      .insert({ contrato_id: data.contratoId, user_id: data.userId } as never);
    if (error) {
      if (/duplicate key|already exists|23505/i.test(error.message)) {
        return { ok: true as const, already: true };
      }
      throw new Error(error.message);
    }
    return { ok: true as const, already: false };
  });

export const removerResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => paresInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { error } = await context.supabase
      .from("contrato_responsaveis")
      .delete()
      .eq("contrato_id", data.contratoId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Helper reutilizado pela rotina diária. Recebe cliente com privilégio suficiente
 * (service role ou super admin) — não faz `ensureAcessoContratos`.
 */
export async function destinatariosDoContrato(
  supabase: Supa,
  contratoId: string,
  criadoPor: string | null,
): Promise<Array<{ user_id: string; nome: string | null; email: string | null }>> {
  const { data: rels, error } = await supabase
    .from("contrato_responsaveis")
    .select("user_id")
    .eq("contrato_id", contratoId);
  if (error) throw new Error(error.message);
  const ids = ((rels ?? []) as { user_id: string }[]).map((r) => r.user_id);
  const finalIds = ids.length > 0 ? ids : criadoPor ? [criadoPor] : [];
  if (finalIds.length === 0) return [];
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, nome, email")
    .in("id", finalIds);
  if (pErr) throw new Error(pErr.message);
  return ((profs ?? []) as { id: string; nome: string | null; email: string | null }[])
    .filter((p) => !!p.email)
    .map((p) => ({ user_id: p.id, nome: p.nome, email: p.email }));
}