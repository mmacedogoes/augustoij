/**
 * Fase 5 — Reajustes dos contratos de prestação de serviços.
 *
 * Regras principais:
 * - Contrato tem reajuste PENDENTE quando: situação = ativo, valor > 0,
 *   mes_base_reajuste definido, e a data-base "corrente" (1º dia do
 *   mes_base do ano vigente) já ocorreu, sem linha em contrato_reajustes
 *   para aquela competência.
 * - Também vira pendente quando faltam <= 30 dias para essa data-base.
 * - Índice "nenhum" nunca aparece como pendente.
 * - Aplicação nunca é automática — sempre pelo usuário.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import { calcularIndiceParaReajuste, round2 } from "./indices";
import { gerarEventosInterno } from "./eventos.functions";
import { hojeBR } from "./eventos-core";
import { registrarAuditoriaContrato } from "./auditoria.server";

function brl(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------- utilitários

function competenciaVigenteMesBase(mesBase: number, hoje: string): string {
  // 1º dia do mes_base do ano em que a data-base mais recente já ocorreu.
  const [ay, am] = hoje.split("-").map((n) => Number(n));
  const ano = am >= mesBase ? ay : ay - 1;
  return `${ano}-${String(mesBase).padStart(2, "0")}-01`;
}
function diasEntre(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.floor((b - a) / 86_400_000);
}

// ------------------------------------------------------ listPendenciasReajuste

export type PendenciaReajuste = {
  contrato_id: string;
  prestador_nome: string;
  condominio_id: string;
  condominio_nome: string;
  valor_atual: number;
  indice_reajuste: string;
  mes_base_reajuste: number;
  competencia: string; // YYYY-MM-01
  ultimo_reajuste_em: string | null;
  dias_ate_data_base: number; // negativo = vencido
};

export const listPendenciasReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ condominioId: z.string().uuid().nullable().optional() }).parse(v ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    let q = context.supabase
      .from("contratos_servico")
      .select(
        "id, condominio_id, prestador_nome, valor, indice_reajuste, mes_base_reajuste, ultimo_reajuste_em, situacao, condominios(nome)",
      )
      .eq("situacao", "ativo")
      .not("mes_base_reajuste", "is", null)
      .not("valor", "is", null)
      .neq("indice_reajuste", "nenhum");
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    type Row = {
      id: string; condominio_id: string; prestador_nome: string;
      valor: number | null; indice_reajuste: string; mes_base_reajuste: number;
      ultimo_reajuste_em: string | null; condominios: { nome: string } | null;
    };
    const list = (rows ?? []) as Row[];
    if (list.length === 0) return { rows: [] as PendenciaReajuste[] };

    const ids = list.map((r) => r.id);
    // Busca competências já aplicadas para deduzir pendências.
    const { data: aplicados, error: eA } = await context.supabase
      .from("contrato_reajustes")
      .select("contrato_id, competencia")
      .in("contrato_id", ids);
    if (eA) throw new Error(eA.message);
    const jaAplicado = new Set<string>(
      ((aplicados ?? []) as Array<{ contrato_id: string; competencia: string }>).map(
        (r) => `${r.contrato_id}:${r.competencia}`,
      ),
    );

    const hoje = hojeBR();
    const pend: PendenciaReajuste[] = [];
    for (const r of list) {
      if (!r.valor || Number(r.valor) <= 0) continue;
      const competencia = competenciaVigenteMesBase(r.mes_base_reajuste, hoje);
      const key = `${r.id}:${competencia}`;
      if (jaAplicado.has(key)) continue;
      const dias = diasEntre(hoje, competencia);
      if (dias > 30) continue; // ainda longe da data-base
      pend.push({
        contrato_id: r.id,
        prestador_nome: r.prestador_nome,
        condominio_id: r.condominio_id,
        condominio_nome: r.condominios?.nome ?? "—",
        valor_atual: Number(r.valor),
        indice_reajuste: r.indice_reajuste,
        mes_base_reajuste: r.mes_base_reajuste,
        competencia,
        ultimo_reajuste_em: r.ultimo_reajuste_em,
        dias_ate_data_base: dias,
      });
    }
    pend.sort((a, b) => a.dias_ate_data_base - b.dias_ate_data_base);
    return { rows: pend };
  });

// -------------------------------------------------------- getSugestaoReajuste

export const getSugestaoReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: c, error } = await context.supabase
      .from("contratos_servico")
      .select("id, valor, indice_reajuste, mes_base_reajuste, ultimo_reajuste_em, situacao")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contrato não encontrado");
    if (!c.mes_base_reajuste) throw new Error("Contrato sem mês base de reajuste");

    const valorAtual = Number(c.valor ?? 0);
    const hoje = hojeBR();
    const competencia = competenciaVigenteMesBase(c.mes_base_reajuste, hoje);

    const sug = await calcularIndiceParaReajuste({
      indiceContratual: c.indice_reajuste ?? "nenhum",
      mesBase: c.mes_base_reajuste,
    });
    const pctSugerido = sug.acumuladoSugerido ?? 0;
    const valorSugerido = round2(valorAtual * (1 + pctSugerido / 100));
    return {
      valorAtual,
      competencia,
      indiceContratual: sug.indiceContratual,
      indiceSugerido: sug.indiceSugerido,
      acumuladoContratual: sug.acumuladoContratual,
      acumuladoSugerido: sug.acumuladoSugerido,
      substituicaoPorNegativo: sug.substituicaoPorNegativo,
      valorSugerido,
      erroApi: sug.erroApi,
      janela: sug.janela,
    };
  });

// -------------------------------------------------------------- aplicarReajuste

const aplicarSchema = z.object({
  contratoId: z.string().uuid(),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Competência inválida"),
  valorNovo: z.number().positive("O valor novo deve ser maior que zero"),
  percentualAplicado: z.number(),
  percentualIndice: z.number().nullable().optional(),
  indiceUtilizado: z.string().min(1, "Informe o índice utilizado").max(40),
  fonte: z.enum(["bcb", "manual"]).default("manual"),
  observacao: z.string().max(500).nullable().optional(),
});

export const aplicarReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => aplicarSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    const { data: c, error } = await context.supabase
      .from("contratos_servico")
      .select("id, valor")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contrato não encontrado");
    const valorAnterior = Number(c.valor ?? 0);
    if (valorAnterior <= 0) throw new Error("Contrato sem valor atual definido");

    // Bloqueio de duplicidade (também protegido por índice único).
    const { data: existente, error: eEx } = await context.supabase
      .from("contrato_reajustes")
      .select("id")
      .eq("contrato_id", data.contratoId)
      .eq("competencia", data.competencia)
      .maybeSingle();
    if (eEx) throw new Error(eEx.message);
    if (existente) throw new Error("Já existe reajuste para esta competência");

    const row = {
      contrato_id: data.contratoId,
      competencia: data.competencia,
      valor_anterior: valorAnterior,
      valor_novo: round2(data.valorNovo),
      indice_utilizado: data.indiceUtilizado,
      percentual_indice: data.percentualIndice ?? null,
      percentual_aplicado: data.percentualAplicado,
      fonte: data.fonte,
      observacao: data.observacao ?? null,
    };
    const { error: eIns } = await context.supabase
      .from("contrato_reajustes")
      .insert(row as never);
    if (eIns) {
      if (/23505|duplicate key/i.test(eIns.message)) {
        throw new Error("Já existe reajuste para esta competência");
      }
      throw new Error(eIns.message);
    }

    const { error: eUp } = await context.supabase
      .from("contratos_servico")
      .update({ valor: round2(data.valorNovo), ultimo_reajuste_em: data.competencia } as never)
      .eq("id", data.contratoId);
    if (eUp) throw new Error(eUp.message);

    try { await gerarEventosInterno(context.supabase, data.contratoId); }
    catch (e) { console.warn("Falha ao regerar eventos após reajuste:", e); }

    return { ok: true };
  });

// ---------------------------------------------------------------- adiar (dispensar)

export const adiarReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        motivo: z.string().trim().min(3, "Explique o motivo").max(500),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: c, error } = await context.supabase
      .from("contratos_servico")
      .select("id, valor")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contrato não encontrado");
    const valor = Number(c.valor ?? 0);

    const row = {
      contrato_id: data.contratoId,
      competencia: data.competencia,
      valor_anterior: valor,
      valor_novo: valor,
      indice_utilizado: "Dispensado",
      percentual_indice: null,
      percentual_aplicado: 0,
      fonte: "manual" as const,
      observacao: data.motivo,
    };
    const { error: eIns } = await context.supabase
      .from("contrato_reajustes")
      .insert(row as never);
    if (eIns) {
      if (/23505|duplicate key/i.test(eIns.message)) {
        throw new Error("Já existe registro para esta competência");
      }
      throw new Error(eIns.message);
    }
    return { ok: true };
  });

// -------------------------------------------------------- listHistoricoReajustes

export type ReajusteLinha = {
  id: string;
  competencia: string;
  valor_anterior: number;
  valor_novo: number;
  indice_utilizado: string;
  percentual_indice: number | null;
  percentual_aplicado: number;
  fonte: string;
  observacao: string | null;
  aplicado_por: string;
  aplicado_por_nome: string | null;
  created_at: string;
};

export const listHistoricoReajustes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("contrato_reajustes")
      .select("id, competencia, valor_anterior, valor_novo, indice_utilizado, percentual_indice, percentual_aplicado, fonte, observacao, aplicado_por, created_at")
      .eq("contrato_id", data.contratoId)
      .order("competencia", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    type Row = Omit<ReajusteLinha, "aplicado_por_nome">;
    const list = (rows ?? []) as Row[];
    if (list.length === 0) return { rows: [] as ReajusteLinha[] };
    const ids = Array.from(new Set(list.map((r) => r.aplicado_por).filter(Boolean)));
    let nomes: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      nomes = Object.fromEntries(
        ((profs ?? []) as Array<{ id: string; nome: string | null; email: string | null }>)
          .map((p) => [p.id, p.nome ?? p.email ?? "—"]),
      );
    }
    return {
      rows: list.map((r) => ({ ...r, aplicado_por_nome: nomes[r.aplicado_por] ?? null })),
    };
  });

// -------------------------------------------------------- desfazerUltimoReajuste

export const desfazerUltimoReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: ultimo, error } = await context.supabase
      .from("contrato_reajustes")
      .select("id, valor_anterior, competencia")
      .eq("contrato_id", data.contratoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ultimo) throw new Error("Não há reajuste para desfazer");

    const { error: eDel } = await context.supabase
      .from("contrato_reajustes")
      .delete()
      .eq("id", ultimo.id);
    if (eDel) throw new Error(eDel.message);

    // Restaura o valor anterior no contrato e limpa ultimo_reajuste_em
    // recalculando pelo próximo (se ainda existir).
    const { data: anterior } = await context.supabase
      .from("contrato_reajustes")
      .select("competencia")
      .eq("contrato_id", data.contratoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: eUp } = await context.supabase
      .from("contratos_servico")
      .update({
        valor: Number(ultimo.valor_anterior),
        ultimo_reajuste_em: (anterior as { competencia: string } | null)?.competencia ?? null,
      } as never)
      .eq("id", data.contratoId);
    if (eUp) throw new Error(eUp.message);

    try { await gerarEventosInterno(context.supabase, data.contratoId); }
    catch (e) { console.warn("Falha ao regerar eventos ao desfazer reajuste:", e); }

    return { ok: true };
  });