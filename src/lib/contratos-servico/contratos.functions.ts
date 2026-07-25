import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAcessoContratos } from "./guard";
import { gerarChecklistsInterno } from "./checklists.functions";
import { gerarEventosInterno } from "./eventos.functions";
import { registrarAuditoriaContrato } from "./auditoria.server";
import { sincronizarContratoNoAcervo } from "./ai-context.server";
import {
  contratoServicoSchema,
  idInput,
  listFiltersSchema,
  obrigacaoSchema,
} from "./schemas";
import { statusExibicaoContrato, type StatusExibicaoContrato } from "./status";

// -------------------------------------------------------------------- catálogo

export const listTiposServicoContrato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAcessoContratos(context);
    const { data, error } = await context.supabase
      .from("tipos_servico_contrato")
      .select("id, slug, nome, terceirizacao_padrao, ordem, ativo")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// -------------------------------------------------------------------- listagem

type ContratoLinha = {
  id: string;
  condominio_id: string;
  condominio_nome: string;
  tipo_servico_id: string | null;
  tipo_servico_nome: string | null;
  prestador_nome: string;
  situacao: string;
  prazo_indeterminado: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  valor: number | null;
  tipo_valor: string;
  status: StatusExibicaoContrato;
};

export const listContratosServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listFiltersSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    let query = context.supabase
      .from("contratos_servico")
      .select(
        "id, condominio_id, tipo_servico_id, situacao, prestador_nome, prazo_indeterminado, data_inicio, data_fim, valor, tipo_valor, condominios(nome), tipos_servico_contrato(nome)",
      );
    if (data.condominioId) query = query.eq("condominio_id", data.condominioId);
    if (data.tipoServicoId) query = query.eq("tipo_servico_id", data.tipoServicoId);
    if (data.busca && data.busca.length > 0) {
      const b = data.busca.replace(/%/g, "").replace(/,/g, " ");
      query = query.ilike("prestador_nome", `%${b}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      condominio_id: string;
      tipo_servico_id: string | null;
      situacao: string;
      prestador_nome: string;
      prazo_indeterminado: boolean;
      data_inicio: string | null;
      data_fim: string | null;
      valor: number | null;
      tipo_valor: string;
      condominios: { nome: string } | null;
      tipos_servico_contrato: { nome: string } | null;
    };

    const enriched: ContratoLinha[] = ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      condominio_id: r.condominio_id,
      condominio_nome: r.condominios?.nome ?? "—",
      tipo_servico_id: r.tipo_servico_id,
      tipo_servico_nome: r.tipos_servico_contrato?.nome ?? null,
      prestador_nome: r.prestador_nome,
      situacao: r.situacao,
      prazo_indeterminado: r.prazo_indeterminado,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim,
      valor: r.valor,
      tipo_valor: r.tipo_valor,
      status: statusExibicaoContrato(r),
    }));

    // Contadores globais (não afetados pelo filtro de status, respeitam os demais)
    const counters = {
      vigentes: enriched.filter((r) => r.status === "vigente").length,
      vencendo: enriched.filter((r) => r.status === "vence_em_breve").length,
      vencidos: enriched.filter((r) => r.status === "vencido").length,
    };

    let filtered = enriched;
    if (data.statusExibicao) filtered = enriched.filter((r) => r.status === data.statusExibicao);

    filtered.sort((a, b) => {
      if (a.data_fim === b.data_fim) return a.prestador_nome.localeCompare(b.prestador_nome);
      if (a.data_fim === null) return 1;
      if (b.data_fim === null) return -1;
      return a.data_fim.localeCompare(b.data_fim);
    });

    return { rows: filtered, counters };
  });

// -------------------------------------------------------------------- ficha

export const getContratoServico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { data: contrato, error } = await context.supabase
      .from("contratos_servico")
      .select(
        "*, condominios(id, nome), tipos_servico_contrato(id, slug, nome, terceirizacao_padrao)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contrato) throw new Error("Contrato não encontrado");

    const { data: obrigacoes, error: obrErr } = await context.supabase
      .from("contrato_obrigacoes")
      .select("id, parte, descricao, periodicidade, clausula_origem, ordem, origem")
      .eq("contrato_id", data.id)
      .order("parte", { ascending: true })
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    if (obrErr) throw new Error(obrErr.message);

    return { contrato, obrigacoes: obrigacoes ?? [] };
  });

// -------------------------------------------------------------------- upsert

export const upsertContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => contratoServicoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);

    const payload = {
      condominio_id: data.condominio_id,
      tipo_servico_id: data.tipo_servico_id ?? null,
      situacao: data.situacao,
      prestador_nome: data.prestador_nome,
      prestador_documento: data.prestador_documento,
      prestador_email: data.prestador_email,
      prestador_telefone: data.prestador_telefone,
      objeto: data.objeto,
      terceirizacao_mao_de_obra: data.terceirizacao_mao_de_obra,
      data_inicio: data.data_inicio,
      prazo_indeterminado: data.prazo_indeterminado,
      data_fim: data.prazo_indeterminado ? null : data.data_fim,
      renovacao_automatica: data.renovacao_automatica,
      aviso_previo_dias: data.aviso_previo_dias,
      valor: data.valor,
      tipo_valor: data.tipo_valor,
      dia_vencimento: data.dia_vencimento,
      indice_reajuste: data.indice_reajuste,
      mes_base_reajuste: data.mes_base_reajuste,
      multa_rescisoria: data.multa_rescisoria,
      exige_seguro_rc: data.exige_seguro_rc,
      garantias: data.garantias,
      foro: data.foro,
    } as const;

    if (data.id) {
      const { error } = await context.supabase
        .from("contratos_servico")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      try {
        await gerarChecklistsInterno(context.supabase, data.id);
      } catch (e) {
        console.warn("Falha ao regerar checklists (edição):", e);
      }
      try {
        await gerarEventosInterno(context.supabase, data.id);
      } catch (e) {
        console.warn("Falha ao regerar eventos (edição):", e);
      }
      void sincronizarContratoNoAcervo(context.supabase, { contratoId: data.id });
      await registrarAuditoriaContrato({
        contratoId: data.id,
        condominioId: data.condominio_id,
        acao: "contrato.editar",
        descricao: `Contrato editado: ${data.prestador_nome}.`,
        userId: context.userId,
      });
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("contratos_servico")
      .insert({ ...payload, criado_por: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const novoId = inserted.id as string;
    try {
      await gerarChecklistsInterno(context.supabase, novoId);
    } catch (e) {
      console.warn("Falha ao gerar checklists (criação):", e);
    }
    try {
      await gerarEventosInterno(context.supabase, novoId);
    } catch (e) {
      console.warn("Falha ao gerar eventos (criação):", e);
    }
    void sincronizarContratoNoAcervo(context.supabase, { contratoId: novoId });
    await registrarAuditoriaContrato({
      contratoId: novoId,
      condominioId: data.condominio_id,
      acao: "contrato.criar",
      descricao: `Contrato criado: ${data.prestador_nome}.`,
      userId: context.userId,
    });
    return { id: novoId };
  });

// -------------------------------------------------------------------- remove

export const removeContratoServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { data: prev } = await context.supabase
      .from("contratos_servico")
      .select("prestador_nome, condominio_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("contratos_servico")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await registrarAuditoriaContrato({
      contratoId: null,
      condominioId: (prev?.condominio_id as string | undefined) ?? null,
      acao: "contrato.excluir",
      descricao: `Contrato excluído${prev?.prestador_nome ? `: ${prev.prestador_nome}` : ""}.`,
      userId: context.userId,
    });
    return { ok: true };
  });

// -------------------------------------------------------------------- obrigações

export const upsertObrigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => obrigacaoSchema.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const payload = {
      contrato_id: data.contrato_id,
      parte: data.parte,
      descricao: data.descricao,
      periodicidade: data.periodicidade,
      clausula_origem: data.clausula_origem,
      ordem: data.ordem,
      origem: "manual" as const,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("contrato_obrigacoes")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("contrato_obrigacoes")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const removeObrigacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    await ensureAcessoContratos(context);
    const { error } = await context.supabase
      .from("contrato_obrigacoes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------------- condomínios (seletor)

export const listCondominiosParaContratos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAcessoContratos(context);
    const { data, error } = await context.supabase
      .from("condominios")
      .select("id, nome, cidade, uf")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// re-export para consumo tipado no cliente
export type { ContratoLinha };
// Silence unused import warning in some tsgo modes
void z;