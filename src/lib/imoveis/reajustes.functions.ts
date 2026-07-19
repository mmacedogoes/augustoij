import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";
import { SERIES_BCB, acumularPercentualMensal, fetchSerieBcb } from "./indices-core";

/**
 * Calcula sugestão de reajuste para o contrato:
 * - IGP-M acumulado nos 12 meses anteriores ao mês_base do ano corrente.
 * - Se acumulado negativo, usa IPCA acumulado dos 12 meses anteriores.
 * Não persiste — só retorna a sugestão.
 */
export const calcularReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        mesReferencia: z
          .object({ ano: z.number().int(), mes: z.number().int().min(1).max(12) })
          .optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: c, error } = await context.supabase
      .from("contratos_locacao")
      .select("id, valor_aluguel, indice_reajuste, mes_base_reajuste")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contrato não encontrado");

    const hoje = new Date();
    const anoRef = data.mesReferencia?.ano ?? hoje.getUTCFullYear();
    const mesRef = data.mesReferencia?.mes ?? (c.mes_base_reajuste ?? hoje.getUTCMonth() + 1);

    // 12 meses ANTERIORES ao mês de referência.
    let anoFim = anoRef;
    let mesFim = mesRef - 1;
    if (mesFim < 1) { mesFim = 12; anoFim -= 1; }
    let anoIni = anoFim;
    let mesIni = mesFim - 11;
    while (mesIni < 1) { mesIni += 12; anoIni -= 1; }

    const igpm = await fetchSerieBcb(context.supabase, {
      serie: SERIES_BCB.IGPM, anoIni, mesIni, anoFim, mesFim,
    });
    const acumIgpm = acumularPercentualMensal(igpm.pontos);

    let indiceUsado = "IGP-M";
    let acumulado = acumIgpm;
    let acumIpca: number | null = null;

    if (acumIgpm < 0) {
      const ipca = await fetchSerieBcb(context.supabase, {
        serie: SERIES_BCB.IPCA, anoIni, mesIni, anoFim, mesFim,
      });
      acumIpca = acumularPercentualMensal(ipca.pontos);
      indiceUsado = "IPCA";
      acumulado = acumIpca;
    }

    const valorAtual = Number(c.valor_aluguel ?? 0);
    const valorNovo = valorAtual * (1 + acumulado / 100);

    return {
      valorAtual,
      indiceUsado,
      acumulado,
      acumuladoIgpm: acumIgpm,
      acumuladoIpca: acumIpca,
      valorNovo,
      janela: { anoIni, mesIni, anoFim, mesFim },
      erroApi: igpm.erro,
    };
  });

export const aplicarReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        contratoId: z.string().uuid(),
        indiceUsado: z.string().min(1),
        percentual: z.number(),
        valorAnterior: z.number(),
        valorNovo: z.number(),
        data: z.string().min(10),
        observacoes: z.string().nullable().optional(),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error: eIns } = await context.supabase.from("reajustes").insert({
      contrato_locacao_id: data.contratoId,
      owner_admin_id: context.userId,
      data: data.data,
      indice_usado: data.indiceUsado,
      percentual: data.percentual,
      valor_anterior: data.valorAnterior,
      valor_novo: data.valorNovo,
      observacoes: data.observacoes ?? null,
    });
    if (eIns) throw new Error(eIns.message);
    const { error: eUp } = await context.supabase
      .from("contratos_locacao")
      .update({ valor_aluguel: data.valorNovo })
      .eq("id", data.contratoId);
    if (eUp) throw new Error(eUp.message);
    return { ok: true };
  });

export const listReajustes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("reajustes")
      .select("*")
      .eq("contrato_locacao_id", data.contratoId)
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

/** Calcula a data do próximo reajuste. Base = último reajuste OU início da vigência. */
function proximaDataReajuste(inicio: string | null, ultimo: string | null, periodicidade: number): string | null {
  const base = ultimo ?? inicio;
  if (!base) return null;
  const d = new Date(base + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + (periodicidade || 12));
  return d.toISOString().slice(0, 10);
}

/** Retorna contratos ativos cuja próxima data de reajuste é ≤ hoje + janelaDias. */
export const listReajustesPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSuperAdmin(context);
    const { data: contratos, error } = await context.supabase
      .from("contratos_locacao")
      .select("id, inquilino_nome, data_inicio_vigencia, periodicidade_reajuste_meses, indice_reajuste, valor_aluguel, imoveis(descricao, edificio, numero_unidade)")
      .eq("owner_admin_id", context.userId)
      .eq("status", "ativo");
    if (error) throw new Error(error.message);
    const { data: reajustes } = await context.supabase
      .from("reajustes")
      .select("contrato_locacao_id, data")
      .eq("owner_admin_id", context.userId)
      .order("data", { ascending: false });
    const ultimoPorContrato = new Map<string, string>();
    for (const r of reajustes ?? []) {
      if (!ultimoPorContrato.has(r.contrato_locacao_id)) ultimoPorContrato.set(r.contrato_locacao_id, r.data);
    }
    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setUTCDate(limite.getUTCDate() + 30);
    const rows: Array<{
      contratoId: string; inquilinoNome: string | null; imovelLabel: string;
      proximaData: string; diasParaReajuste: number; indice: string; valorAtual: number | null;
    }> = [];
    for (const c of contratos ?? []) {
      const proxima = proximaDataReajuste(
        c.data_inicio_vigencia,
        ultimoPorContrato.get(c.id) ?? null,
        c.periodicidade_reajuste_meses ?? 12,
      );
      if (!proxima) continue;
      const dProx = new Date(proxima + "T00:00:00Z");
      if (dProx.getTime() > limite.getTime()) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const im = c.imoveis as any;
      rows.push({
        contratoId: c.id,
        inquilinoNome: c.inquilino_nome,
        imovelLabel: [im?.edificio, im?.descricao, im?.numero_unidade ? `un. ${im.numero_unidade}` : null].filter(Boolean).join(" — ") || "Imóvel",
        proximaData: proxima,
        diasParaReajuste: Math.floor((dProx.getTime() - hoje.getTime()) / 86400000),
        indice: c.indice_reajuste ?? "IGP-M",
        valorAtual: c.valor_aluguel,
      });
    }
    return { rows };
  });

/** Retorna a próxima data de reajuste para um único contrato, junto com o último reajuste conhecido. */
export const getReajusteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: c } = await context.supabase
      .from("contratos_locacao")
      .select("data_inicio_vigencia, periodicidade_reajuste_meses")
      .eq("id", data.contratoId)
      .maybeSingle();
    const { data: r } = await context.supabase
      .from("reajustes")
      .select("data")
      .eq("contrato_locacao_id", data.contratoId)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();
    const proxima = proximaDataReajuste(
      c?.data_inicio_vigencia ?? null,
      r?.data ?? null,
      c?.periodicidade_reajuste_meses ?? 12,
    );
    const hoje = new Date();
    const dias = proxima
      ? Math.floor((new Date(proxima + "T00:00:00Z").getTime() - hoje.getTime()) / 86400000)
      : null;
    return { proximaData: proxima, ultimoReajuste: r?.data ?? null, diasParaReajuste: dias, pendente: dias != null && dias <= 30 };
  });

// -------- Caução --------

export type CaucaoInfo = {
  possui: boolean;
  tipo: string | null;
  valor_depositado: number | null;
  data_deposito: string | null;
  corrige_com_rendimento: boolean;
  valor_atual_override: number | null;
  observacoes: string | null;
};

export const getCaucaoAtualizada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: caucao, error } = await context.supabase
      .from("caucoes")
      .select("*")
      .eq("contrato_locacao_id", data.contratoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caucao || !caucao.possui) {
      return { caucao: null, valorAtual: 0, memoria: null, dataReferencia: null };
    }
    const valorDep = Number(caucao.valor_depositado ?? 0);
    const dataRef = new Date().toISOString().slice(0, 10);

    if (caucao.valor_atual_override != null) {
      return {
        caucao,
        valorAtual: Number(caucao.valor_atual_override),
        memoria: "Valor definido manualmente (override).",
        dataReferencia: dataRef,
      };
    }

    if (
      caucao.tipo !== "poupanca" ||
      !caucao.corrige_com_rendimento ||
      !caucao.data_deposito
    ) {
      return {
        caucao,
        valorAtual: valorDep,
        memoria: "Sem correção — usando o valor depositado.",
        dataReferencia: dataRef,
      };
    }

    // Corrige pela poupança: acumula rendimentos mensais desde o mês do depósito.
    const dep = new Date(caucao.data_deposito + "T00:00:00Z");
    // Considera meses fechados: começa no mês seguinte ao depósito.
    let anoIni = dep.getUTCFullYear();
    let mesIni = dep.getUTCMonth() + 2; // JS: mês 0-based, +1 para 1-based, +1 mais para próximo mês
    while (mesIni > 12) { mesIni -= 12; anoIni += 1; }
    const hoje = new Date();
    let anoFim = hoje.getUTCFullYear();
    let mesFim = hoje.getUTCMonth(); // mês anterior ao atual (mês fechado)
    if (mesFim < 1) { mesFim = 12; anoFim -= 1; }

    if (anoFim < anoIni || (anoFim === anoIni && mesFim < mesIni)) {
      return {
        caucao,
        valorAtual: valorDep,
        memoria: "Depósito recente — ainda não há meses fechados de rendimento.",
        dataReferencia: dataRef,
      };
    }

    const poup = await fetchSerieBcb(context.supabase, {
      serie: SERIES_BCB.POUPANCA, anoIni, mesIni, anoFim, mesFim,
    });
    const acum = acumularPercentualMensal(poup.pontos);
    const valorAtual = valorDep * (1 + acum / 100);
    const memoria =
      `Poupança acumulada de ${String(mesIni).padStart(2, "0")}/${anoIni} a ${String(mesFim).padStart(2, "0")}/${anoFim}: ${acum.toFixed(4)}% ` +
      `→ ${valorDep.toFixed(2)} × (1 + ${(acum / 100).toFixed(6)}) = ${valorAtual.toFixed(2)}` +
      (poup.erro ? ` — atenção: API BCB retornou erro (${poup.erro}). Ajuste manualmente se necessário.` : "");
    return { caucao, valorAtual, memoria, dataReferencia: dataRef };
  });