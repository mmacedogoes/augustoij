import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";
import { SERIES_BCB, acumularPercentualMensal, fetchSerieBcb } from "./indices-core";

// ---------- utilidades de data ----------
const FERIADOS_FIXOS = new Set([
  "01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25",
]);
function isFeriadoOuFimDeSemana(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return true;
  const key = `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return FERIADOS_FIXOS.has(key);
}
function proximoDiaUtil(d: Date): Date {
  const out = new Date(d);
  while (isFeriadoOuFimDeSemana(out)) out.setUTCDate(out.getUTCDate() + 1);
  return out;
}
function toIso(d: Date): string { return d.toISOString().slice(0, 10); }
function competenciaMes(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

// ---------- geração automática ----------

export const gerarHonorariosMensais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ proprietarioId: z.string().uuid().optional() }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);

    // contratos de administração ativos (opcionalmente filtrando por proprietário)
    let q = context.supabase
      .from("contratos_administracao")
      .select("id, proprietario_id, percent_honorario_mensal, status, data_inicio")
      .eq("status", "ativo");
    if (data.proprietarioId) q = q.eq("proprietario_id", data.proprietarioId);
    const { data: adms, error: eA } = await q;
    if (eA) throw new Error(eA.message);
    if (!adms || adms.length === 0) return { criados: 0 };

    // imóveis de cada proprietário
    const propIds = Array.from(new Set(adms.map((a) => a.proprietario_id).filter(Boolean)));
    const { data: imoveis, error: eI } = await context.supabase
      .from("imoveis")
      .select("id, proprietario_id")
      .in("proprietario_id", propIds);
    if (eI) throw new Error(eI.message);
    const imovelIds = (imoveis ?? []).map((i) => i.id);
    if (imovelIds.length === 0) return { criados: 0 };
    const imovelToProp = new Map<string, string>();
    for (const im of imoveis ?? []) imovelToProp.set(im.id, im.proprietario_id);

    // contratos de locação ativos daqueles imóveis
    const { data: locs, error: eL } = await context.supabase
      .from("contratos_locacao")
      .select("id, imovel_id, valor_aluguel, dia_vencimento, data_inicio_vigencia, status")
      .in("imovel_id", imovelIds)
      .eq("status", "ativo");
    if (eL) throw new Error(eL.message);
    if (!locs || locs.length === 0) return { criados: 0 };

    const admByProp = new Map<string, (typeof adms)[number]>();
    for (const a of adms) if (a.proprietario_id) admByProp.set(a.proprietario_id, a);

    const linhas: Array<{
      contrato_administracao_id: string;
      contrato_locacao_id: string;
      owner_admin_id: string;
      tipo: string;
      competencia: string;
      base_calculo: number;
      percentual: number;
      valor: number;
      vencimento: string;
    }> = [];

    const hoje = new Date();
    for (const loc of locs) {
      const propId = imovelToProp.get(loc.imovel_id ?? "");
      if (!propId) continue;
      const adm = admByProp.get(propId);
      if (!adm) continue;
      if (!loc.data_inicio_vigencia || !loc.dia_vencimento || !loc.valor_aluguel) continue;
      const perc = Number(adm.percent_honorario_mensal ?? 0);
      if (perc <= 0) continue;
      const aluguel = Number(loc.valor_aluguel);
      const valor = aluguel * (perc / 100);
      const dia = Math.min(28, loc.dia_vencimento);

      const inicio = new Date(loc.data_inicio_vigencia + "T00:00:00Z");
      let y = inicio.getUTCFullYear();
      let m = inicio.getUTCMonth() + 1;
      const yEnd = hoje.getUTCFullYear();
      const mEnd = hoje.getUTCMonth() + 1;
      while (y < yEnd || (y === yEnd && m <= mEnd)) {
        const venc = proximoDiaUtil(new Date(Date.UTC(y, m - 1, dia)));
        linhas.push({
          contrato_administracao_id: adm.id,
          contrato_locacao_id: loc.id,
          owner_admin_id: context.userId,
          tipo: "mensal",
          competencia: competenciaMes(y, m),
          base_calculo: aluguel,
          percentual: perc,
          valor,
          vencimento: toIso(venc),
        });
        m += 1;
        if (m > 12) { m = 1; y += 1; }
      }
    }

    if (linhas.length === 0) return { criados: 0 };
    const { error: eIns } = await context.supabase
      .from("honorarios")
      .upsert(linhas, {
        onConflict: "contrato_administracao_id,contrato_locacao_id,tipo,competencia",
        ignoreDuplicates: true,
      });
    if (eIns) throw new Error(eIns.message);
    return { criados: linhas.length };
  });

export const lancarHonorarioRenovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      contratoLocacaoId: z.string().uuid(),
      novoAluguel: z.number().positive(),
      dataReferencia: z.string().min(10),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: loc, error: eL } = await context.supabase
      .from("contratos_locacao")
      .select("id, imovel_id, imoveis(proprietario_id)")
      .eq("id", data.contratoLocacaoId)
      .maybeSingle();
    if (eL) throw new Error(eL.message);
    if (!loc) throw new Error("Contrato de locação não encontrado");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propId = (loc as any).imoveis?.proprietario_id as string | undefined;
    if (!propId) throw new Error("Imóvel sem proprietário vinculado");

    const { data: adm, error: eA } = await context.supabase
      .from("contratos_administracao")
      .select("id, percent_honorario_renovacao")
      .eq("proprietario_id", propId)
      .eq("status", "ativo")
      .maybeSingle();
    if (eA) throw new Error(eA.message);
    if (!adm) throw new Error("Não há contrato de administração ativo para este proprietário");
    const perc = Number(adm.percent_honorario_renovacao ?? 0);
    if (perc <= 0) throw new Error("Percentual de honorário de renovação não configurado");

    const valor = data.novoAluguel * (perc / 100);
    const competencia = data.dataReferencia.slice(0, 7);
    const { error: eIns } = await context.supabase
      .from("honorarios")
      .upsert(
        [{
          contrato_administracao_id: adm.id,
          contrato_locacao_id: loc.id,
          owner_admin_id: context.userId,
          tipo: "renovacao",
          competencia,
          base_calculo: data.novoAluguel,
          percentual: perc,
          valor,
          vencimento: data.dataReferencia,
        }],
        { onConflict: "contrato_administracao_id,contrato_locacao_id,tipo,competencia", ignoreDuplicates: false },
      );
    if (eIns) throw new Error(eIns.message);
    return { ok: true, valor };
  });

// ---------- consulta ----------

export const listHonorarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      proprietarioId: z.string().uuid().optional(),
      competencia: z.string().optional(),
      status: z.enum(["todos", "a_receber", "recebido", "atrasado"]).default("todos"),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    let q = context.supabase
      .from("honorarios")
      .select(
        "id, tipo, competencia, base_calculo, percentual, valor, vencimento, pago, data_pagamento, observacoes, " +
        "contrato_administracao_id, contrato_locacao_id, " +
        "contratos_administracao(proprietario_id, proprietarios(id, nome, telefone, pix)), " +
        "contratos_locacao(imoveis(descricao, edificio, numero_unidade, endereco))",
      )
      .order("vencimento", { ascending: false });
    if (data.competencia) q = q.eq("competencia", data.competencia);
    if (data.status === "recebido") q = q.eq("pago", true);
    if (data.status === "a_receber") q = q.eq("pago", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // filtro extra (proprietario, atrasado)
    const hoje = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filt: any[] = rows ?? [];
    if (data.proprietarioId) {
      filt = filt.filter((r) => r.contratos_administracao?.proprietario_id === data.proprietarioId);
    }
    if (data.status === "atrasado") {
      filt = filt.filter((r) => !r.pago && r.vencimento && r.vencimento < hoje);
    }
    return { rows: filt };
  });

export const marcarHonorarioRecebido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid(),
      pago: z.boolean(),
      data_pagamento: z.string().nullable().optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase
      .from("honorarios")
      .update({
        pago: data.pago,
        data_pagamento: data.pago ? (data.data_pagamento ?? new Date().toISOString().slice(0, 10)) : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- mora do honorário (multa 2% + juros 1% a.m. + IGP-M) ----------

export const calcularMoraHonorario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: h, error } = await context.supabase
      .from("honorarios")
      .select("valor, vencimento, pago")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!h) throw new Error("Honorário não encontrado");
    if (h.pago) return { diasAtraso: 0, multa: 0, juros: 0, correcao: 0, indice: 0, total: Number(h.valor) };
    const venc = new Date(h.vencimento + "T00:00:00Z");
    const hoje = new Date();
    const dias = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000));
    const valor = Number(h.valor ?? 0);
    if (dias === 0) return { diasAtraso: 0, multa: 0, juros: 0, correcao: 0, indice: 0, total: valor };

    const multa = valor * 0.02;
    const juros = valor * 0.01 * (dias / 30);

    // IGP-M acumulado do mês seguinte ao vencimento até o mês anterior a hoje
    let anoIni = venc.getUTCFullYear();
    let mesIni = venc.getUTCMonth() + 2;
    while (mesIni > 12) { mesIni -= 12; anoIni += 1; }
    let anoFim = hoje.getUTCFullYear();
    let mesFim = hoje.getUTCMonth();
    if (mesFim < 1) { mesFim = 12; anoFim -= 1; }
    let acum = 0;
    if (anoFim > anoIni || (anoFim === anoIni && mesFim >= mesIni)) {
      const igpm = await fetchSerieBcb(context.supabase, {
        serie: SERIES_BCB.IGPM, anoIni, mesIni, anoFim, mesFim,
      });
      acum = acumularPercentualMensal(igpm.pontos);
    }
    const correcao = valor * (acum / 100);
    const total = valor + multa + juros + correcao;
    return { diasAtraso: dias, multa, juros, correcao, indice: acum, total };
  });

// ---------- dados p/ recibo & WhatsApp ----------

export const getHonorarioDetalhes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: h, error } = await context.supabase
      .from("honorarios")
      .select(
        "id, tipo, competencia, base_calculo, percentual, valor, vencimento, pago, data_pagamento, " +
        "contratos_administracao(administrador_nome, pix_recebimento, banco_recebimento, agencia_recebimento, conta_recebimento, " +
        "  proprietarios(nome, telefone, email)), " +
        "contratos_locacao(imoveis(descricao, edificio, numero_unidade, endereco))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!h) throw new Error("Honorário não encontrado");
    return h;
  });