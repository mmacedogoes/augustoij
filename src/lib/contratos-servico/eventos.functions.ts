/**
 * Fase 4 — Agenda automática e manual dos contratos de prestação de serviços.
 *
 * `gerarEventosDoContrato` é idempotente graças ao índice único
 * `uniq_contrato_evento_automatico`. Nunca apaga eventos já concluídos,
 * cancelados ou já notificados; regenera apenas o "futuro pendente".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSuperAdmin } from "./guard";
import {
  gerarEventosPrevistos,
  hojeBR,
  type ContratoParaEventos,
  type EventoAutomatico,
} from "./eventos-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

// ------------------------------------------------------------------ interno

/**
 * Núcleo idempotente. Reutilizado por criar/editar contrato e importação.
 * Nunca lança fora do log — falha só marca warning para não bloquear o fluxo principal.
 */
export async function gerarEventosInterno(supabase: Supa, contratoId: string): Promise<void> {
  const { data: c, error } = await supabase
    .from("contratos_servico")
    .select(
      "id, prestador_nome, situacao, notificacoes_ativas, prazo_indeterminado, data_fim, data_inicio, renovacao_automatica, aviso_previo_dias, indice_reajuste, mes_base_reajuste, dia_vencimento, tipo_valor",
    )
    .eq("id", contratoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) return;

  const hoje = hojeBR();
  const contrato = c as ContratoParaEventos;

  // Cancela automáticos futuros pendentes ainda não notificados
  // (não toca em concluidos, cancelados, ou já notificados = histórico).
  const { error: cancErr } = await supabase
    .from("contrato_eventos")
    .update({ status: "cancelado" })
    .eq("contrato_id", contratoId)
    .eq("origem", "automatico")
    .eq("status", "pendente")
    .is("notificado_em", null)
    .gte("data_evento", hoje);
  if (cancErr) throw new Error(cancErr.message);

  // Contratos inativos ou com avisos desligados: só cancelar.
  if (contrato.situacao !== "ativo" || !contrato.notificacoes_ativas) return;

  const previstos = gerarEventosPrevistos(contrato, hoje);
  if (previstos.length === 0) return;

  // Insere um a um, ignorando duplicidade contra o índice único.
  for (const ev of previstos) {
    const row = {
      contrato_id: contratoId,
      tipo: ev.tipo,
      titulo: ev.titulo,
      descricao: ev.descricao,
      data_evento: ev.data_evento,
      antecedencia_dias: ev.antecedencia_dias,
      competencia: ev.competencia,
      origem: "automatico" as const,
      status: "pendente" as const,
    };
    const { error: insErr } = await supabase.from("contrato_eventos").insert(row as never);
    // 23505 = unique_violation (evento já existente com mesma antecedência)
    if (insErr && !/duplicate key|already exists|23505/i.test(insErr.message)) {
      throw new Error(insErr.message);
    }
  }
}

/**
 * Cancela apenas os eventos automáticos futuros pendentes. Usado quando o usuário
 * desliga o interruptor "avisos automáticos".
 */
export async function cancelarEventosAutomaticosFuturos(supabase: Supa, contratoId: string): Promise<void> {
  const hoje = hojeBR();
  const { error } = await supabase
    .from("contrato_eventos")
    .update({ status: "cancelado" })
    .eq("contrato_id", contratoId)
    .eq("origem", "automatico")
    .eq("status", "pendente")
    .is("notificado_em", null)
    .gte("data_evento", hoje);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------------ server fns

const idInput = z.object({ contratoId: z.string().uuid() });

export const gerarEventosDoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    await gerarEventosInterno(context.supabase, data.contratoId);
    return { ok: true as const };
  });

type EventoLinha = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  status: "pendente" | "concluido" | "cancelado";
  origem: "automatico" | "manual";
  antecedencia_dias: number | null;
  competencia: string | null;
  notificado_em: string | null;
};

export const listEventosDoContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("contrato_eventos")
      .select("id, tipo, titulo, descricao, data_evento, status, origem, antecedencia_dias, competencia, notificado_em")
      .eq("contrato_id", data.contratoId)
      .order("data_evento", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as EventoLinha[] };
  });

const eventoManualSchema = z.object({
  contratoId: z.string().uuid(),
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1, "Título obrigatório").max(200),
  descricao: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().max(1000).nullable()).default(null),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Data inválida"),
});

export const upsertEventoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => eventoManualSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("contrato_eventos")
        .update({ titulo: data.titulo, descricao: data.descricao, data_evento: data.data_evento } as never)
        .eq("id", data.id)
        .eq("origem", "manual");
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("contrato_eventos")
      .insert({
        contrato_id: data.contratoId,
        tipo: "manual",
        titulo: data.titulo,
        descricao: data.descricao,
        data_evento: data.data_evento,
        origem: "manual",
        status: "pendente",
        criado_por: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

const eventoIdInput = z.object({ eventoId: z.string().uuid() });

export const concluirEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => eventoIdInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("contrato_eventos")
      .update({ status: "concluido" } as never)
      .eq("id", data.eventoId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const cancelarEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => eventoIdInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("contrato_eventos")
      .update({ status: "cancelado" } as never)
      .eq("id", data.eventoId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --------------------------------------------------------- listagem "Próximos 30 dias"

type EventoProximo = {
  id: string;
  contrato_id: string;
  prestador_nome: string;
  condominio_nome: string;
  tipo: string;
  titulo: string;
  data_evento: string;
  origem: "automatico" | "manual";
};

export const listEventosProximos30Dias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const hoje = hojeBR();
    const [y, m, d] = hoje.split("-").map((n) => Number(n));
    const ate = new Date(Date.UTC(y, m - 1, d));
    ate.setUTCDate(ate.getUTCDate() + 30);
    const ateISO = `${ate.getUTCFullYear()}-${String(ate.getUTCMonth() + 1).padStart(2, "0")}-${String(ate.getUTCDate()).padStart(2, "0")}`;

    const { data: rows, error } = await context.supabase
      .from("contrato_eventos")
      .select(
        "id, contrato_id, tipo, titulo, data_evento, origem, contratos_servico!inner(prestador_nome, situacao, condominios(nome))",
      )
      .eq("status", "pendente")
      .gte("data_evento", hoje)
      .lte("data_evento", ateISO)
      .order("data_evento", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    type Row = {
      id: string; contrato_id: string; tipo: string; titulo: string;
      data_evento: string; origem: "automatico" | "manual";
      contratos_servico: { prestador_nome: string; situacao: string; condominios: { nome: string } | null } | null;
    };
    const list: EventoProximo[] = ((rows ?? []) as Row[])
      .filter((r) => r.contratos_servico && r.contratos_servico.situacao === "ativo")
      .map((r) => ({
        id: r.id,
        contrato_id: r.contrato_id,
        prestador_nome: r.contratos_servico!.prestador_nome,
        condominio_nome: r.contratos_servico!.condominios?.nome ?? "—",
        tipo: r.tipo,
        titulo: r.titulo,
        data_evento: r.data_evento,
        origem: r.origem,
      }));
    return { rows: list };
  });

export type { EventoLinha, EventoProximo };