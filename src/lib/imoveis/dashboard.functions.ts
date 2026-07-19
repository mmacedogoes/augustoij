import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

function competenciaAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const getDashboardImoveisMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const owner = context.userId;
    const [
      { count: proprietariosCount },
      { count: imoveisCount },
      { count: contratosAtivosCount },
      { data: pendencias },
      { data: honorariosMes },
    ] = await Promise.all([
      context.supabase.from("proprietarios").select("id", { count: "exact", head: true }).eq("owner_admin_id", owner),
      context.supabase.from("imoveis").select("id", { count: "exact", head: true }).eq("owner_admin_id", owner),
      context.supabase.from("contratos_locacao").select("id", { count: "exact", head: true }).eq("owner_admin_id", owner).eq("status", "ativo"),
      context.supabase.from("pagamentos").select("id, valor, vencimento").eq("owner_admin_id", owner).eq("pago", false).lte("vencimento", new Date().toISOString().slice(0, 10)),
      context.supabase.from("honorarios").select("valor, pago").eq("owner_admin_id", owner).eq("competencia", competenciaAtual()),
    ]);
    const honorariosAReceber = (honorariosMes ?? []).filter((h) => !h.pago).reduce((a, b) => a + Number(b.valor ?? 0), 0);
    return {
      proprietarios: proprietariosCount ?? 0,
      imoveis: imoveisCount ?? 0,
      contratosAtivos: contratosAtivosCount ?? 0,
      pendenciasAbertas: pendencias?.length ?? 0,
      honorariosAReceberMes: honorariosAReceber,
    };
  });

export type AlertaItem = {
  chave: string;
  tipo: "aluguel_vencido" | "encargo_vencido" | "contrato_terminando" | "reajuste_devido" | "manutencao_aberta" | "honorario_vencido";
  titulo: string;
  descricao: string;
  contratoId?: string | null;
  imovelId?: string | null;
  valor?: number | null;
  diasAtraso?: number | null;
  mora?: { multa: number; juros: number; total: number } | null;
};

export const listAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const owner = context.userId;
    const hoje = new Date();
    const hojeIso = hoje.toISOString().slice(0, 10);
    const alertas: AlertaItem[] = [];

    // Pagamentos vencidos e não pagos
    const { data: pgVencidos } = await context.supabase
      .from("pagamentos")
      .select("id, tipo, valor, vencimento, competencia, contrato_locacao_id, contratos_locacao(inquilino_nome, multa_mora_percent, juros_mora_mensal_percent)")
      .eq("owner_admin_id", owner)
      .eq("pago", false)
      .lt("vencimento", hojeIso);
    for (const p of pgVencidos ?? []) {
      const contrato = p.contratos_locacao as unknown as { inquilino_nome: string | null; multa_mora_percent: number; juros_mora_mensal_percent: number } | null;
      const venc = new Date(p.vencimento + "T00:00:00Z");
      const dias = Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
      const valor = Number(p.valor ?? 0);
      const multa = valor * ((contrato?.multa_mora_percent ?? 2) / 100);
      const juros = valor * ((contrato?.juros_mora_mensal_percent ?? 1) / 100) * (dias / 30);
      alertas.push({
        chave: `${p.tipo === "aluguel" ? "aluguel_vencido" : "encargo_vencido"}:${p.id}`,
        tipo: p.tipo === "aluguel" ? "aluguel_vencido" : "encargo_vencido",
        titulo: `${p.tipo.toUpperCase()} vencido — ${contrato?.inquilino_nome ?? "inquilino"}`,
        descricao: `Competência ${p.competencia} • ${dias} dias de atraso`,
        contratoId: p.contrato_locacao_id,
        valor,
        diasAtraso: dias,
        mora: { multa, juros, total: valor + multa + juros },
      });
    }

    // Contratos terminando em ≤ 90 dias
    const { data: contratos } = await context.supabase
      .from("contratos_locacao")
      .select("id, inquilino_nome, data_inicio_vigencia, prazo_meses, mes_base_reajuste, periodicidade_reajuste_meses, status")
      .eq("owner_admin_id", owner)
      .eq("status", "ativo");
    // Último reajuste por contrato — usado para próxima data de reajuste
    const { data: reajustesRows } = await context.supabase
      .from("reajustes")
      .select("contrato_locacao_id, data")
      .eq("owner_admin_id", owner)
      .order("data", { ascending: false });
    const ultimoReajuste = new Map<string, string>();
    for (const r of reajustesRows ?? []) {
      if (!ultimoReajuste.has(r.contrato_locacao_id)) ultimoReajuste.set(r.contrato_locacao_id, r.data);
    }
    for (const c of contratos ?? []) {
      if (c.data_inicio_vigencia && c.prazo_meses) {
        const inicio = new Date(c.data_inicio_vigencia + "T00:00:00Z");
        const fim = new Date(inicio);
        fim.setUTCMonth(fim.getUTCMonth() + c.prazo_meses);
        const dias = Math.floor((fim.getTime() - hoje.getTime()) / 86400000);
        if (dias >= 0 && dias <= 90) {
          alertas.push({
            chave: `contrato_terminando:${c.id}`,
            tipo: "contrato_terminando",
            titulo: `Contrato terminando — ${c.inquilino_nome ?? ""}`,
            descricao: `Termina em ${dias} dias (${fim.toISOString().slice(0, 10)}). Sugerir aditivo de renovação.`,
            contratoId: c.id,
          });
        }
      }
      // Reajuste devido (próxima data ≤ 30 dias ou já vencida) — atualização de valor pendente
      const base = ultimoReajuste.get(c.id) ?? c.data_inicio_vigencia;
      const periodicidade = c.periodicidade_reajuste_meses ?? 12;
      if (base) {
        const dBase = new Date(base + "T00:00:00Z");
        dBase.setUTCMonth(dBase.getUTCMonth() + periodicidade);
        const diasRea = Math.floor((dBase.getTime() - hoje.getTime()) / 86400000);
        if (diasRea <= 30) {
          const proxIso = dBase.toISOString().slice(0, 10);
          const status = diasRea < 0 ? `atrasado há ${Math.abs(diasRea)} dias` : `em ${diasRea} dias`;
          alertas.push({
            chave: `reajuste_devido:${c.id}:${proxIso}`,
            tipo: "reajuste_devido",
            titulo: `Atualização de valor pendente — ${c.inquilino_nome ?? ""}`,
            descricao: `Próximo reajuste ${status} (${proxIso}). Calcule o novo valor e comunique ao inquilino.`,
            contratoId: c.id,
          });
        }
      }
    }

    // Manutenções abertas
    const { data: manut } = await context.supabase
      .from("manutencoes")
      .select("id, titulo, status, imovel_id")
      .eq("owner_admin_id", owner)
      .in("status", ["solicitada", "em_andamento"]);
    for (const m of manut ?? []) {
      alertas.push({
        chave: `manutencao_aberta:${m.id}`,
        tipo: "manutencao_aberta",
        titulo: `Manutenção ${m.status} — ${m.titulo ?? ""}`,
        descricao: `Imóvel: ${m.imovel_id}`,
        imovelId: m.imovel_id,
      });
    }

    // Honorários vencidos
    const { data: honVenc } = await context.supabase
      .from("honorarios")
      .select("id, valor, vencimento, competencia, contrato_locacao_id")
      .eq("owner_admin_id", owner)
      .eq("pago", false)
      .lt("vencimento", hojeIso);
    for (const h of honVenc ?? []) {
      alertas.push({
        chave: `honorario_vencido:${h.id}`,
        tipo: "honorario_vencido",
        titulo: `Honorário vencido`,
        descricao: `Competência ${h.competencia ?? "—"}, R$ ${Number(h.valor ?? 0).toFixed(2)}.`,
        contratoId: h.contrato_locacao_id,
        valor: Number(h.valor ?? 0),
      });
    }

    // Filtrar resolvidos
    const { data: resolvidos } = await context.supabase
      .from("alertas_resolvidos")
      .select("chave")
      .eq("owner_admin_id", owner);
    const set = new Set((resolvidos ?? []).map((r) => r.chave));
    return { alertas: alertas.filter((a) => !set.has(a.chave)) };
  });

export const resolverAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ chave: z.string().min(1), observacao: z.string().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase.from("alertas_resolvidos").upsert(
      { owner_admin_id: context.userId, chave: data.chave, observacao: data.observacao ?? null },
      { onConflict: "owner_admin_id,chave" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reabrirAlerta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ chave: z.string().min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("alertas_resolvidos")
      .delete()
      .eq("owner_admin_id", context.userId)
      .eq("chave", data.chave);
    if (error) throw new Error(error.message);
    return { ok: true };
  });