/**
 * Fase 3 — Checklists e matriz tributária dos contratos de prestação de serviços.
 *
 * Gera checklists de forma idempotente a partir de modelos
 * (`checklist_templates_itens`) e das retenções aplicáveis. Nunca apaga
 * histórico: mudanças de estado (ex.: terceirização desmarcada) apenas
 * desativam checklists/itens.
 *
 * Acesso restrito ao super-admin (mesmo padrão das fases 1 e 2).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";
import {
  calcularRetencoesAplicaveis,
  descricaoItemTributario,
  type RetencaoAplicavel,
} from "./retencoes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

type TipoChecklist = "fiscalizacao" | "pagamento" | "tributario" | "trabalhista";

const TITULOS: Record<TipoChecklist, string> = {
  fiscalizacao: "Fiscalização",
  pagamento: "Pagamento",
  tributario: "Tributário",
  trabalhista: "Trabalhista",
};

// -------------------------------------------------------------- helpers internos

type ExpectedItem = { descricao: string; base_legal: string | null; ordem: number };

async function loadTemplatesFor(
  supabase: Supa,
  tipo: "fiscalizacao" | "pagamento" | "trabalhista",
  tipoServicoSlug: string | null,
): Promise<ExpectedItem[]> {
  let q = supabase
    .from("checklist_templates_itens")
    .select("descricao, base_legal, ordem, tipo_servico_slug")
    .eq("tipo_checklist", tipo)
    .eq("ativo", true);
  if (tipo === "fiscalizacao") {
    if (tipoServicoSlug) q = q.or(`tipo_servico_slug.is.null,tipo_servico_slug.eq.${tipoServicoSlug}`);
    else q = q.is("tipo_servico_slug", null);
  } else {
    q = q.is("tipo_servico_slug", null);
  }
  const { data, error } = await q.order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ExpectedItem[]).map((r) => ({
    descricao: r.descricao,
    base_legal: r.base_legal,
    ordem: r.ordem,
  }));
}

async function ensureChecklist(
  supabase: Supa,
  contratoId: string,
  tipo: TipoChecklist,
  ativo: boolean,
): Promise<{ id: string; ativo: boolean } | null> {
  const { data: existing, error } = await supabase
    .from("contrato_checklists")
    .select("id, ativo")
    .eq("contrato_id", contratoId)
    .eq("tipo", tipo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) {
    if (existing.ativo !== ativo) {
      const { error: uErr } = await supabase
        .from("contrato_checklists")
        .update({ ativo })
        .eq("id", existing.id);
      if (uErr) throw new Error(uErr.message);
    }
    return { id: existing.id as string, ativo };
  }
  if (!ativo) return null; // não cria trabalhista para contrato sem terceirização
  const { data: inserted, error: iErr } = await supabase
    .from("contrato_checklists")
    .insert({ contrato_id: contratoId, tipo, titulo: TITULOS[tipo], ativo: true })
    .select("id, ativo")
    .single();
  if (iErr) throw new Error(iErr.message);
  return { id: inserted.id as string, ativo: true };
}

async function syncChecklistItems(
  supabase: Supa,
  checklistId: string,
  expected: ExpectedItem[],
  desativarNaoEsperados: boolean,
): Promise<void> {
  const { data: current, error } = await supabase
    .from("contrato_checklist_itens")
    .select("id, descricao, ativo, base_legal, ordem")
    .eq("checklist_id", checklistId);
  if (error) throw new Error(error.message);
  const byDesc = new Map<string, { id: string; ativo: boolean; base_legal: string | null; ordem: number }>();
  for (const r of (current ?? []) as {
    id: string;
    descricao: string;
    ativo: boolean;
    base_legal: string | null;
    ordem: number;
  }[]) {
    byDesc.set(r.descricao, r);
  }

  const toInsert: {
    checklist_id: string;
    descricao: string;
    base_legal: string | null;
    ordem: number;
    ativo: boolean;
  }[] = [];
  const esperados = new Set<string>();
  for (const item of expected) {
    esperados.add(item.descricao);
    const found = byDesc.get(item.descricao);
    if (!found) {
      toInsert.push({
        checklist_id: checklistId,
        descricao: item.descricao,
        base_legal: item.base_legal,
        ordem: item.ordem,
        ativo: true,
      });
    } else if (!found.ativo) {
      const { error: uErr } = await supabase
        .from("contrato_checklist_itens")
        .update({ ativo: true })
        .eq("id", found.id);
      if (uErr) throw new Error(uErr.message);
    }
  }
  if (toInsert.length > 0) {
    const { error: iErr } = await supabase.from("contrato_checklist_itens").insert(toInsert);
    if (iErr) throw new Error(iErr.message);
  }
  if (desativarNaoEsperados) {
    for (const [descricao, row] of byDesc) {
      if (!esperados.has(descricao) && row.ativo) {
        const { error: uErr } = await supabase
          .from("contrato_checklist_itens")
          .update({ ativo: false })
          .eq("id", row.id);
        if (uErr) throw new Error(uErr.message);
      }
    }
  }
}

/**
 * Núcleo idempotente. Reutilizado tanto pelo server fn público quanto pelos
 * fluxos de criação/edição de contrato (fases 1 e 2).
 */
export async function gerarChecklistsInterno(
  supabase: Supa,
  contratoId: string,
): Promise<void> {
  const { data: c, error } = await supabase
    .from("contratos_servico")
    .select("id, tipo_servico_id, terceirizacao_mao_de_obra, tipos_servico_contrato(slug)")
    .eq("id", contratoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Contrato não encontrado");
  const tipoSlug: string | null = c.tipos_servico_contrato?.slug ?? null;
  const terceirizacao: boolean = c.terceirizacao_mao_de_obra === true;

  // Fiscalização — sempre ativa
  const fisc = await ensureChecklist(supabase, contratoId, "fiscalizacao", true);
  if (fisc) await syncChecklistItems(supabase, fisc.id, await loadTemplatesFor(supabase, "fiscalizacao", tipoSlug), false);

  // Pagamento — sempre ativa
  const pag = await ensureChecklist(supabase, contratoId, "pagamento", true);
  if (pag) await syncChecklistItems(supabase, pag.id, await loadTemplatesFor(supabase, "pagamento", null), false);

  // Tributário — sempre ativo; itens são gerados a partir das retenções
  const trib = await ensureChecklist(supabase, contratoId, "tributario", true);
  if (trib) {
    const retencoes = await calcularRetencoesAplicaveis(supabase, contratoId);
    const expected: ExpectedItem[] = retencoes.map((r, idx) => ({
      descricao: descricaoItemTributario(r),
      base_legal: r.base_legal,
      ordem: idx + 1,
    }));
    await syncChecklistItems(supabase, trib.id, expected, true);
  }

  // Trabalhista — só quando houver terceirização (desativa em vez de excluir)
  const trab = await ensureChecklist(supabase, contratoId, "trabalhista", terceirizacao);
  if (trab && terceirizacao)
    await syncChecklistItems(supabase, trab.id, await loadTemplatesFor(supabase, "trabalhista", null), false);
}

// ------------------------------------------------------------------ server fns

const idSchema = z.object({ contratoId: z.string().uuid() });

export const gerarChecklistsDoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    await gerarChecklistsInterno(context.supabase, data.contratoId);
    return { ok: true as const };
  });

// ---- getRetencoesDoContrato

export const getRetencoesDoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const rows = await calcularRetencoesAplicaveis(context.supabase, data.contratoId);
    return { rows: rows as RetencaoAplicavel[] };
  });

// ---- getChecklistsDoContrato

const getChecklistsSchema = z.object({
  contratoId: z.string().uuid(),
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/u, "Competência deve ser o primeiro dia do mês (YYYY-MM-01)"),
});

type ChecklistCardItem = {
  id: string;
  descricao: string;
  base_legal: string | null;
  ordem: number;
  marcacao: {
    id: string;
    situacao: "pendente" | "conforme" | "nao_conforme" | "nao_se_aplica";
    observacao: string | null;
    marcado_por: string | null;
    marcado_em: string | null;
    marcado_por_nome: string | null;
  } | null;
};

type ChecklistCard = {
  id: string;
  tipo: TipoChecklist;
  titulo: string;
  periodo: { id: string | null; competencia: string; status: "aberto" | "concluido" };
  itens: ChecklistCardItem[];
  progresso: { total: number; marcados: number; nao_conformes: number };
  somente_leitura: boolean;
};

function primeiroDiaMesAtualBR(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function mesAnterior(competencia: string): string {
  const [y, m] = competencia.split("-").map((n) => Number(n));
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function truncarParaMes(dataISO: string | null): string | null {
  if (!dataISO) return null;
  const s = dataISO.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return `${s.slice(0, 7)}-01`;
}

export const getChecklistsDoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => getChecklistsSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    const { data: c, error: cErr } = await context.supabase
      .from("contratos_servico")
      .select("id, situacao, data_inicio, data_fim, created_at")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Contrato não encontrado");

    const encerradoOuSuspenso = c.situacao === "encerrado" || c.situacao === "suspenso";

    // Janela de competências: da data de assinatura do contrato (fallback: criação)
    // até o mês atual OU até o mês da data_fim, o que vier primeiro.
    // Para contratos por prazo indeterminado sem data_fim, o teto é o mês atual.
    const inicioMes = truncarParaMes(c.data_inicio);
    const criadoMes = truncarParaMes(c.created_at);
    const inferior = inicioMes ?? criadoMes ?? primeiroDiaMesAtualBR();
    const mesAtual = primeiroDiaMesAtualBR();
    const fimMes = truncarParaMes(c.data_fim);
    const superior = fimMes && fimMes < mesAtual ? fimMes : mesAtual;
    const competenciaDentroDoIntervalo = data.competencia >= inferior && data.competencia <= superior;
    const podeCriarPeriodo = !encerradoOuSuspenso && competenciaDentroDoIntervalo;

    const { data: checklists, error: chErr } = await context.supabase
      .from("contrato_checklists")
      .select("id, tipo, titulo, ativo")
      .eq("contrato_id", data.contratoId)
      .eq("ativo", true);
    if (chErr) throw new Error(chErr.message);

    const ordemTipos: TipoChecklist[] = ["fiscalizacao", "pagamento", "tributario", "trabalhista"];
    const cards: ChecklistCard[] = [];

    for (const tipo of ordemTipos) {
      const ch = (checklists ?? []).find((x: { tipo: string }) => x.tipo === tipo);
      if (!ch) continue;

      const { data: itens, error: iErr } = await context.supabase
        .from("contrato_checklist_itens")
        .select("id, descricao, base_legal, ordem")
        .eq("checklist_id", ch.id)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (iErr) throw new Error(iErr.message);

      // Garantir período (idempotente via unique)
      type PeriodoRow = { id: string; competencia: string; status: "aberto" | "concluido" };
      let periodo: PeriodoRow | null = null;
      const { data: pExist, error: pErr } = await context.supabase
        .from("contrato_checklist_periodos")
        .select("id, competencia, status")
        .eq("checklist_id", ch.id)
        .eq("competencia", data.competencia)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (pExist) {
        periodo = pExist as PeriodoRow;
      } else if (podeCriarPeriodo) {
        const { data: inserted, error: insErr } = await context.supabase
          .from("contrato_checklist_periodos")
          .insert({ checklist_id: ch.id, competencia: data.competencia, status: "aberto" })
          .select("id, competencia, status")
          .single();
        if (insErr) {
          // Corrida com unique — releia
          const { data: retry } = await context.supabase
            .from("contrato_checklist_periodos")
            .select("id, competencia, status")
            .eq("checklist_id", ch.id)
            .eq("competencia", data.competencia)
            .maybeSingle();
          periodo = (retry as PeriodoRow | null) ?? null;
        } else {
          periodo = inserted as PeriodoRow;
        }
      }

      let marcacoesPorItem = new Map<string, ChecklistCardItem["marcacao"]>();
      if (periodo) {
        const { data: marcs, error: mErr } = await context.supabase
          .from("contrato_checklist_marcacoes")
          .select("id, item_id, situacao, observacao, marcado_por, marcado_em")
          .eq("periodo_id", periodo.id);
        if (mErr) throw new Error(mErr.message);

        const userIds = Array.from(
          new Set(((marcs ?? []) as { marcado_por: string | null }[]).map((m) => m.marcado_por).filter((v): v is string => !!v)),
        );
        const nomes = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profs } = await context.supabase
            .from("profiles")
            .select("id, nome")
            .in("id", userIds);
          for (const p of (profs ?? []) as { id: string; nome: string | null }[]) {
            nomes.set(p.id, p.nome ?? "");
          }
        }
        for (const m of (marcs ?? []) as {
          id: string;
          item_id: string;
          situacao: ChecklistCardItem["marcacao"] extends infer T
            ? T extends { situacao: infer S }
              ? S
              : never
            : never;
          observacao: string | null;
          marcado_por: string | null;
          marcado_em: string | null;
        }[]) {
          marcacoesPorItem.set(m.item_id, {
            id: m.id,
            situacao: m.situacao,
            observacao: m.observacao,
            marcado_por: m.marcado_por,
            marcado_em: m.marcado_em,
            marcado_por_nome: m.marcado_por ? (nomes.get(m.marcado_por) ?? null) : null,
          });
        }
      }

      const itensCard: ChecklistCardItem[] = ((itens ?? []) as {
        id: string;
        descricao: string;
        base_legal: string | null;
        ordem: number;
      }[]).map((it) => ({
        id: it.id,
        descricao: it.descricao,
        base_legal: it.base_legal,
        ordem: it.ordem,
        marcacao: marcacoesPorItem.get(it.id) ?? null,
      }));

      const marcados = itensCard.filter(
        (i) => i.marcacao && i.marcacao.situacao !== "pendente",
      ).length;
      const naoConformes = itensCard.filter(
        (i) => i.marcacao && i.marcacao.situacao === "nao_conforme",
      ).length;

      cards.push({
        id: ch.id as string,
        tipo,
        titulo: TITULOS[tipo],
        periodo: periodo
          ? { id: periodo.id, competencia: periodo.competencia, status: periodo.status }
          : { id: null, competencia: data.competencia, status: "aberto" },
        itens: itensCard,
        progresso: { total: itensCard.length, marcados, nao_conformes: naoConformes },
        somente_leitura: encerradoOuSuspenso || !periodo || !competenciaDentroDoIntervalo,
      });
    }

    return {
      competencia: data.competencia,
      intervalo: { inferior, superior },
      encerrado_ou_suspenso: encerradoOuSuspenso,
      cards,
    };
  });

// ---- marcarItemChecklist

const marcarSchema = z.object({
  periodoId: z.string().uuid(),
  itemId: z.string().uuid(),
  situacao: z.enum(["pendente", "conforme", "nao_conforme", "nao_se_aplica"]),
  observacao: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.string().max(1000).nullable())
    .default(null),
});

export const marcarItemChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => marcarSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    // Bloqueia marcação em contratos encerrados/suspensos
    const { data: per, error: pErr } = await context.supabase
      .from("contrato_checklist_periodos")
      .select("id, checklist_id, contrato_checklists(contrato_id, ativo, tipo, contratos_servico(situacao))")
      .eq("id", data.periodoId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!per) throw new Error("Período não encontrado");
    const situacaoContrato: string | undefined = per.contrato_checklists?.contratos_servico?.situacao;
    if (situacaoContrato === "encerrado" || situacaoContrato === "suspenso") {
      throw new Error("Contrato encerrado ou suspenso — checklist somente leitura.");
    }
    if (per.contrato_checklists?.ativo === false) {
      throw new Error("Checklist inativo para este contrato.");
    }

    if (data.situacao === "pendente") {
      const { error: delErr } = await context.supabase
        .from("contrato_checklist_marcacoes")
        .delete()
        .eq("periodo_id", data.periodoId)
        .eq("item_id", data.itemId);
      if (delErr) throw new Error(delErr.message);
    } else {
      const { error: upErr } = await context.supabase
        .from("contrato_checklist_marcacoes")
        .upsert(
          {
            periodo_id: data.periodoId,
            item_id: data.itemId,
            situacao: data.situacao,
            observacao: data.observacao,
            marcado_por: context.userId,
            marcado_em: new Date().toISOString(),
          },
          { onConflict: "periodo_id,item_id" },
        );
      if (upErr) throw new Error(upErr.message);
    }

    // Recalcular status do período
    const { data: itens, error: iErr } = await context.supabase
      .from("contrato_checklist_itens")
      .select("id")
      .eq("checklist_id", per.checklist_id)
      .eq("ativo", true);
    if (iErr) throw new Error(iErr.message);
    const { data: marcs, error: mErr } = await context.supabase
      .from("contrato_checklist_marcacoes")
      .select("item_id, situacao")
      .eq("periodo_id", data.periodoId);
    if (mErr) throw new Error(mErr.message);

    const itemIds = new Set(((itens ?? []) as { id: string }[]).map((i) => i.id));
    const marcadosNaoPendentes = ((marcs ?? []) as { item_id: string; situacao: string }[]).filter(
      (m) => itemIds.has(m.item_id) && m.situacao !== "pendente",
    ).length;
    const novoStatus = itemIds.size > 0 && marcadosNaoPendentes === itemIds.size ? "concluido" : "aberto";
    const { error: sErr } = await context.supabase
      .from("contrato_checklist_periodos")
      .update({ status: novoStatus })
      .eq("id", data.periodoId);
    if (sErr) throw new Error(sErr.message);

    // Trilha de auditoria (agrupada na aba Atividades por dia+contexto).
    try {
      const contratoIdAud = per.contrato_checklists?.contrato_id as string | undefined;
      const tipo = per.contrato_checklists?.tipo as string | undefined;
      if (contratoIdAud) {
        const { registrarAuditoriaContrato } = await import("./auditoria.server");
        await registrarAuditoriaContrato({
          contratoId: contratoIdAud,
          acao: "checklist.marcar",
          descricao: `Checklist${tipo ? ` ${tipo}` : ""} atualizado.`,
          userId: context.userId,
        });
      }
    } catch (e) {
      console.warn("[checklists] audit falhou:", (e as Error).message);
    }

    return { ok: true as const, status: novoStatus };
  });

// Re-export para consumo no cliente
export type { RetencaoAplicavel };
export type { ChecklistCard, ChecklistCardItem };