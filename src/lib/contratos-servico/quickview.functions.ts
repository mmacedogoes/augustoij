/**
 * Consultas leves usadas pela visão rápida do contrato e pelos filtros de
 * pendência da listagem. Mesmo guard da listagem (`ensureAcessoContratos`),
 * para funcionar também sem o plano do painel consolidado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";

function primeiroDiaMesBR(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}-01`;
}

export type ResumoRapidoContrato = {
  responsaveis: string[];
  checklists_pendentes: number;
  checklists_total: number;
};

export const getResumoRapidoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    const { data: rels, error: rErr } = await context.supabase
      .from("contrato_responsaveis")
      .select("user_id")
      .eq("contrato_id", data.contratoId);
    if (rErr) throw new Error(rErr.message);
    const ids = ((rels ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);

    let responsaveis: string[] = [];
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      responsaveis = ((profs ?? []) as Array<{ nome: string | null; email: string | null }>)
        .map((p) => p.nome || p.email || "Usuário")
        .sort((a, b) => a.localeCompare(b));
    }

    const { data: chs } = await context.supabase
      .from("contrato_checklists")
      .select("id")
      .eq("ativo", true)
      .eq("contrato_id", data.contratoId);
    const chIds = ((chs ?? []) as Array<{ id: string }>).map((c) => c.id);

    let pendentes = 0;
    if (chIds.length > 0) {
      const { data: periodos } = await context.supabase
        .from("contrato_checklist_periodos")
        .select("checklist_id, status")
        .in("checklist_id", chIds)
        .eq("competencia", primeiroDiaMesBR())
        .eq("status", "aberto");
      pendentes = new Set(
        ((periodos ?? []) as Array<{ checklist_id: string }>).map((p) => p.checklist_id),
      ).size;
    }

    const out: ResumoRapidoContrato = {
      responsaveis,
      checklists_pendentes: pendentes,
      checklists_total: chIds.length,
    };
    return out;
  });

export const pendenciaTipos = [
  "checklist",
  "sem-responsavel",
  "sem-mes-base",
  "sem-documento",
  "sem-indice",
] as const;

/** Retorna os IDs dos contratos ativos que possuem a pendência informada. */
export const listContratoIdsComPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        tipo: z.enum(pendenciaTipos),
        condominioId: z.string().uuid().nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    let q = context.supabase
      .from("contratos_servico")
      .select("id")
      .eq("situacao", "ativo");
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    if (data.tipo === "sem-mes-base") q = q.is("mes_base_reajuste", null);
    if (data.tipo === "sem-documento") q = q.is("arquivo_path", null).is("documento_id", null);
    if (data.tipo === "sem-indice") q = q.or("indice_reajuste.is.null,indice_reajuste.eq.nenhum");

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = ((rows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return { ids: [] as string[] };

    if (data.tipo === "sem-responsavel") {
      const { data: rels } = await context.supabase
        .from("contrato_responsaveis")
        .select("contrato_id")
        .in("contrato_id", ids);
      const com = new Set(((rels ?? []) as Array<{ contrato_id: string }>).map((r) => r.contrato_id));
      return { ids: ids.filter((id) => !com.has(id)) };
    }

    if (data.tipo === "checklist") {
      const { data: chs } = await context.supabase
        .from("contrato_checklists")
        .select("id, contrato_id")
        .eq("ativo", true)
        .in("contrato_id", ids);
      const checklists = (chs ?? []) as Array<{ id: string; contrato_id: string }>;
      if (checklists.length === 0) return { ids: [] as string[] };
      const { data: periodos } = await context.supabase
        .from("contrato_checklist_periodos")
        .select("checklist_id")
        .in("checklist_id", checklists.map((c) => c.id))
        .eq("competencia", primeiroDiaMesBR())
        .eq("status", "aberto");
      const abertos = new Set(
        ((periodos ?? []) as Array<{ checklist_id: string }>).map((p) => p.checklist_id),
      );
      const comPend = new Set(
        checklists.filter((c) => abertos.has(c.id)).map((c) => c.contrato_id),
      );
      return { ids: ids.filter((id) => comPend.has(id)) };
    }

    return { ids };
  });
