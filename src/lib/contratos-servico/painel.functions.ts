/**
 * Fase 5 — Indicadores agregados do painel de contratos de prestação de serviços.
 * Consultas independentes e curtas: a UI carrega em paralelo e mostra
 * cada bloco assim que responde.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePainelConsolidado } from "./guard";
import { statusExibicaoContrato } from "./status";

const filtroSchema = z.object({
  condominioId: z.string().uuid().nullable().optional(),
});

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

// ---------------------------------------------------- getIndicadoresPainel

export type IndicadoresPainel = {
  vigentes: number;
  vencendo_90d: number;
  vencidos: number;
  reajustes_pendentes: number;
  checklists_pendentes_mes: number;
  nao_conformidades_mes: number;
  valor_mensal_total: number;
  valor_anual_estimado: number;
  valor_global_total: number;
  total_com_pendencias: number;
  sem_responsavel: number;
  sem_indice: number;
  mes_base_ausente: number;
  documentos_ausentes: number;
  distribuicao_tipos: Array<{ tipo_id: string | null; nome: string; total: number }>;
};

export const getIndicadoresPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);

    let q = context.supabase
      .from("contratos_servico")
      .select(
        "id, condominio_id, tipo_servico_id, situacao, prazo_indeterminado, data_fim, valor, tipo_valor, mes_base_reajuste, indice_reajuste, ultimo_reajuste_em, arquivo_path, tipos_servico_contrato(nome)",
      );
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    type Row = {
      id: string; condominio_id: string; tipo_servico_id: string | null;
      situacao: string; prazo_indeterminado: boolean; data_fim: string | null;
      valor: number | null; tipo_valor: string;
      mes_base_reajuste: number | null; indice_reajuste: string | null;
      ultimo_reajuste_em: string | null; arquivo_path: string | null;
      tipos_servico_contrato: { nome: string } | null;
    };
    const list = (rows ?? []) as Row[];
    const ativos = list.filter((r) => r.situacao === "ativo");

    let vigentes = 0, vencendo = 0, vencidos = 0;
    for (const r of list) {
      const s = statusExibicaoContrato(r);
      if (s === "vigente") vigentes += 1;
      else if (s === "vence_em_breve") vencendo += 1;
      else if (s === "vencido") vencidos += 1;
    }

    const valorMensal = ativos
      .filter((r) => r.tipo_valor === "mensal" && r.valor)
      .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

    const valorGlobalAtivos = ativos
      .filter((r) => r.tipo_valor === "global" && r.valor)
      .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

    const valorAnualEstimado = (valorMensal * 12) + valorGlobalAtivos;

    // Alertas de dados incompletos
    const sem_indice = ativos.filter(r => !r.indice_reajuste || r.indice_reajuste === "nenhum").length;
    const mes_base_ausente = ativos.filter(r => !r.mes_base_reajuste).length;
    const documentos_ausentes = ativos.filter(r => !r.arquivo_path).length;

    // Responsáveis
    let sem_responsavel = 0;
    if (ativos.length > 0) {
      const { data: respRel } = await context.supabase
        .from("contrato_responsaveis")
        .select("contrato_id")
        .in("contrato_id", ativos.map(a => a.id));
      const comResp = new Set((respRel ?? []).map(r => r.contrato_id));
      sem_responsavel = ativos.filter(a => !comResp.has(a.id)).length;
    }

    // Distribuição por tipo (apenas ativos).
    const tipoMap = new Map<string, { tipo_id: string | null; nome: string; total: number }>();
    for (const r of ativos) {
      const key = r.tipo_servico_id ?? "__sem_tipo";
      const nome = r.tipos_servico_contrato?.nome ?? "Sem tipo definido";
      const cur = tipoMap.get(key);
      if (cur) cur.total += 1;
      else tipoMap.set(key, { tipo_id: r.tipo_servico_id, nome, total: 1 });
    }
    const distribuicao_tipos = Array.from(tipoMap.values()).sort((a, b) => b.total - a.total);

    // Reajustes pendentes (mesma regra do listPendenciasReajuste, versão resumida).
    let reajustes_pendentes = 0;
    const candidatos = ativos.filter(
      (r) => r.mes_base_reajuste && r.valor && Number(r.valor) > 0 && r.indice_reajuste !== "nenhum",
    );
    if (candidatos.length > 0) {
      const ids = candidatos.map((r) => r.id);
      const { data: aplicados } = await context.supabase
        .from("contrato_reajustes")
        .select("contrato_id, competencia")
        .in("contrato_id", ids);
      const set = new Set<string>(
        ((aplicados ?? []) as Array<{ contrato_id: string; competencia: string }>).map(
          (r) => `${r.contrato_id}:${r.competencia}`,
        ),
      );
      const hoje = new Date();
      const anoRef = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(hoje));
      const mesRef = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit" }).format(hoje));
      const in30 = new Date(hoje.getTime() + 30 * 86_400_000);
      const ano30 = in30.getUTCFullYear();
      const mes30 = in30.getUTCMonth() + 1;
      for (const r of candidatos) {
        const mb = r.mes_base_reajuste!;
        const anoComp = mesRef >= mb ? anoRef : anoRef - 1;
        const comp = `${anoComp}-${String(mb).padStart(2, "0")}-01`;
        if (set.has(`${r.id}:${comp}`)) continue;
        // Elegível se a data-base já passou ou está nos próximos 30 dias.
        const alcancado = anoComp < anoRef || (anoComp === anoRef && mb <= mesRef);
        const proximo = !alcancado && (anoRef === ano30 ? mb <= mes30 : mb <= mes30);
        if (alcancado || proximo) reajustes_pendentes += 1;
      }
    }

    // Checklists pendentes do mês e não conformidades trabalhistas.
    const competencia = primeiroDiaMesBR();
    let checklists_pendentes_mes = 0;
    let nao_conformidades_mes = 0;
    if (ativos.length > 0) {
      const contratoIds = ativos.map((r) => r.id);
      const { data: chs } = await context.supabase
        .from("contrato_checklists")
        .select("id, tipo, contrato_id")
        .eq("ativo", true)
        .in("contrato_id", contratoIds);
      const checklists = (chs ?? []) as Array<{ id: string; tipo: string; contrato_id: string }>;
      if (checklists.length > 0) {
        const chIds = checklists.map((c) => c.id);
        const { data: periodos } = await context.supabase
          .from("contrato_checklist_periodos")
          .select("id, checklist_id, status")
          .in("checklist_id", chIds)
          .eq("competencia", competencia);
        const abertos = ((periodos ?? []) as Array<{ status: string; checklist_id: string }>)
          .filter((p) => p.status === "aberto");
        checklists_pendentes_mes = new Set(abertos.map((p) => p.checklist_id)).size;

        const chTrab = checklists.filter((c) => c.tipo === "trabalhista").map((c) => c.id);
        if (chTrab.length > 0) {
          const { data: perTrab } = await context.supabase
            .from("contrato_checklist_periodos")
            .select("id")
            .in("checklist_id", chTrab)
            .eq("competencia", competencia);
          const perIds = ((perTrab ?? []) as Array<{ id: string }>).map((p) => p.id);
          if (perIds.length > 0) {
            const { data: marc } = await context.supabase
              .from("contrato_checklist_marcacoes")
              .select("id")
              .in("periodo_id", perIds)
              .eq("situacao", "nao_conforme");
            nao_conformidades_mes = (marc ?? []).length;
          }
        }
      }
    }

    const totalPendencias = reajustes_pendentes + 
                           checklists_pendentes_mes + 
                           nao_conformidades_mes + 
                           sem_responsavel + 
                           sem_indice + 
                           mes_base_ausente + 
                           documentos_ausentes;

    const out: IndicadoresPainel = {
      vigentes,
      vencendo_90d: vencendo,
      vencidos,
      reajustes_pendentes,
      checklists_pendentes_mes,
      nao_conformidades_mes,
      valor_mensal_total: valorMensal,
      valor_anual_estimado: valorAnualEstimado,
      valor_global_total: valorGlobalAtivos,
      total_com_pendencias: totalPendencias,
      sem_responsavel,
      sem_indice,
      mes_base_ausente,
      documentos_ausentes,
      distribuicao_tipos,
    };
    return out;
  });

// -------------------------------------------------- listChecklistsPendentesMes

export type ChecklistPendenteMes = {
  contrato_id: string;
  prestador_nome: string;
  condominio_nome: string;
  tipo_servico_nome?: string;
  status: string;
  tipos: string[]; // fiscalizacao | pagamento | tributario | trabalhista
};

export const listChecklistsPendentesMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, situacao, condominios(nome), tipos_servico_contrato(nome)")
      .eq("situacao", "ativo");
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    type C = { 
      id: string; 
      prestador_nome: string; 
      situacao: string;
      condominios: { nome: string } | null; 
      tipos_servico_contrato: { nome: string } | null;
    };
    const list = (contratos ?? []) as C[];
    if (list.length === 0) return { rows: [] as ChecklistPendenteMes[] };

    const ids = list.map((c) => c.id);
    const { data: checklists } = await context.supabase
      .from("contrato_checklists")
      .select("id, tipo, contrato_id")
      .eq("ativo", true)
      .in("contrato_id", ids);
    const chs = ((checklists ?? []) as Array<{ id: string; tipo: string; contrato_id: string }>);
    if (chs.length === 0) return { rows: [] as ChecklistPendenteMes[] };

    const competencia = primeiroDiaMesBR();
    const { data: periodos } = await context.supabase
      .from("contrato_checklist_periodos")
      .select("checklist_id, status")
      .in("checklist_id", chs.map((c) => c.id))
      .eq("competencia", competencia)
      .eq("status", "aberto");
    
    const abertosPorCh = new Set(
      ((periodos ?? []) as Array<{ checklist_id: string }>).map((p) => p.checklist_id),
    );
    
    const porContrato = new Map<string, string[]>();
    for (const ch of chs) {
      if (!abertosPorCh.has(ch.id)) continue;
      const arr = porContrato.get(ch.contrato_id) ?? [];
      arr.push(ch.tipo);
      porContrato.set(ch.contrato_id, arr);
    }
    
    const rows: ChecklistPendenteMes[] = list
      .filter((c) => porContrato.has(c.id))
      .map((c) => ({
        contrato_id: c.id,
        prestador_nome: c.prestador_nome,
        condominio_nome: c.condominios?.nome ?? "—",
        tipo_servico_nome: c.tipos_servico_contrato?.nome ?? undefined,
        status: c.situacao,
        tipos: porContrato.get(c.id)!,
      }));
    return { rows };
  });

// -------------------------------------------------- listContratosSemResponsavel

export type ContratoPendenciaGenerica = {
  contrato_id: string;
  prestador_nome: string;
  condominio_nome: string;
  tipo_servico_nome?: string;
  status: string;
  motivo?: string;
};

export const listContratosSemResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, situacao, condominios(nome), tipos_servico_contrato(nome)")
      .eq("situacao", "ativo");
    
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    
    const list = (contratos ?? []) as any[];
    if (list.length === 0) return { rows: [] };

    const { data: respRel } = await context.supabase
      .from("contrato_responsaveis")
      .select("contrato_id")
      .in("contrato_id", list.map(a => a.id));
    
    const comResp = new Set((respRel ?? []).map(r => r.contrato_id));
    const semResp = list.filter(a => !comResp.has(a.id));

    const rows: ContratoPendenciaGenerica[] = semResp.map(c => ({
      contrato_id: c.id,
      prestador_nome: c.prestador_nome,
      condominio_nome: c.condominios?.nome ?? "—",
      tipo_servico_nome: c.tipos_servico_contrato?.nome,
      status: c.situacao,
      motivo: "Nenhum gestor atribuído"
    }));

    return { rows };
  });

// ---------------------------------------------------- listContratosSemMesBase

export const listContratosSemMesBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, situacao, condominios(nome), tipos_servico_contrato(nome)")
      .eq("situacao", "ativo")
      .is("mes_base_reajuste", null);
    
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    
    const rows: ContratoPendenciaGenerica[] = (contratos ?? []).map((c: any) => ({
      contrato_id: c.id,
      prestador_nome: c.prestador_nome,
      condominio_nome: c.condominios?.nome ?? "—",
      tipo_servico_nome: c.tipos_servico_contrato?.nome,
      status: c.situacao,
      motivo: "Mês-base não definido"
    }));

    return { rows };
  });

// ---------------------------------------------------- listContratosSemDocumento

export const listContratosSemDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, situacao, condominios(nome), tipos_servico_contrato(nome)")
      .eq("situacao", "ativo")
      .is("arquivo_path", null)
      .is("documento_id", null);
    
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    
    const rows: ContratoPendenciaGenerica[] = (contratos ?? []).map((c: any) => ({
      contrato_id: c.id,
      prestador_nome: c.prestador_nome,
      condominio_nome: c.condominios?.nome ?? "—",
      tipo_servico_nome: c.tipos_servico_contrato?.nome,
      status: c.situacao,
      motivo: "Documento original ausente"
    }));

    return { rows };
  });

// -------------------------------------------------- listContratosSemIndice

export const listContratosSemIndice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, situacao, condominios(nome), tipos_servico_contrato(nome)")
      .eq("situacao", "ativo")
      .or("indice_reajuste.is.null,indice_reajuste.eq.nenhum");
    
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    
    const rows: ContratoPendenciaGenerica[] = (contratos ?? []).map((c: any) => ({
      contrato_id: c.id,
      prestador_nome: c.prestador_nome,
      condominio_nome: c.condominios?.nome ?? "—",
      tipo_servico_nome: c.tipos_servico_contrato?.nome,
      status: c.situacao,
      motivo: "Índice de reajuste não definido"
    }));

    return { rows };
  });

// ------------------------------------------ listNaoConformidadesTrabalhistasMes

export type NaoConformidadeMes = {
  contrato_id: string;
  prestador_nome: string;
  condominio_nome: string;
  descricao: string;
  marcado_em: string;
};

export const listNaoConformidadesTrabalhistasMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => filtroSchema.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    await ensurePainelConsolidado(context);
    let q = context.supabase
      .from("contratos_servico")
      .select("id, prestador_nome, condominios(nome)")
      .eq("situacao", "ativo");
    if (data.condominioId) q = q.eq("condominio_id", data.condominioId);
    const { data: contratos, error } = await q;
    if (error) throw new Error(error.message);
    type C = { id: string; prestador_nome: string; condominios: { nome: string } | null };
    const cs = (contratos ?? []) as C[];
    if (cs.length === 0) return { rows: [] as NaoConformidadeMes[] };
    const contratoInfo = new Map(cs.map((c) => [c.id, c]));

    const { data: chs } = await context.supabase
      .from("contrato_checklists")
      .select("id, contrato_id")
      .eq("ativo", true)
      .eq("tipo", "trabalhista")
      .in("contrato_id", cs.map((c) => c.id));
    const checklists = ((chs ?? []) as Array<{ id: string; contrato_id: string }>);
    if (checklists.length === 0) return { rows: [] as NaoConformidadeMes[] };
    const chToContrato = new Map(checklists.map((c) => [c.id, c.contrato_id]));

    const competencia = primeiroDiaMesBR();
    const { data: pers } = await context.supabase
      .from("contrato_checklist_periodos")
      .select("id, checklist_id")
      .in("checklist_id", checklists.map((c) => c.id))
      .eq("competencia", competencia);
    const periodos = ((pers ?? []) as Array<{ id: string; checklist_id: string }>);
    if (periodos.length === 0) return { rows: [] as NaoConformidadeMes[] };
    const perToCh = new Map(periodos.map((p) => [p.id, p.checklist_id]));

    const { data: marc } = await context.supabase
      .from("contrato_checklist_marcacoes")
      .select("periodo_id, item_id, marcado_em, contrato_checklist_itens(descricao)")
      .in("periodo_id", periodos.map((p) => p.id))
      .eq("situacao", "nao_conforme")
      .order("marcado_em", { ascending: false })
      .limit(50);
    type M = { periodo_id: string; marcado_em: string | null; contrato_checklist_itens: { descricao: string } | null };
    const rows: NaoConformidadeMes[] = ((marc ?? []) as M[]).map((m) => {
      const chId = perToCh.get(m.periodo_id);
      const cId = chId ? chToContrato.get(chId) : null;
      const c = cId ? contratoInfo.get(cId) : null;
      return {
        contrato_id: cId ?? "",
        prestador_nome: c?.prestador_nome ?? "—",
        condominio_nome: c?.condominios?.nome ?? "—",
        descricao: m.contrato_checklist_itens?.descricao ?? "Item sem descrição",
        marcado_em: m.marcado_em ?? "",
      };
    }).filter((r) => r.contrato_id);
    return { rows };
  });