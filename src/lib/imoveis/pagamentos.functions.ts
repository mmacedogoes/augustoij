import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

// -------- Utilidades de data --------
// Feriados nacionais fixos (aproximação simples para ajuste de vencimento).
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
  while (isFeriadoOuFimDeSemana(out)) {
    out.setUTCDate(out.getUTCDate() + 1);
  }
  return out;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function competenciaMes(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

// -------- Geração de parcelas --------

type Encargos = {
  condominio?: boolean;
  agua?: boolean;
  luz?: boolean;
  iptu?: boolean;
  tcr?: boolean;
};

type ContratoParaGerar = {
  id: string;
  owner_admin_id: string;
  data_inicio_vigencia: string | null;
  dia_vencimento: number | null;
  valor_aluguel: number | null;
  encargos_inquilino: Encargos | null;
};

function buildParcelasEsperadas(c: ContratoParaGerar): Array<{
  contrato_locacao_id: string;
  owner_admin_id: string;
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number | null;
}> {
  if (!c.data_inicio_vigencia || !c.dia_vencimento) return [];
  const inicio = new Date(c.data_inicio_vigencia + "T00:00:00Z");
  const hoje = new Date();
  const parcelas: Array<{
    contrato_locacao_id: string;
    owner_admin_id: string;
    tipo: string;
    competencia: string;
    vencimento: string;
    valor: number | null;
  }> = [];
  const dia = Math.min(28, c.dia_vencimento);
  const yStart = inicio.getUTCFullYear();
  const mStart = inicio.getUTCMonth() + 1;
  const yEnd = hoje.getUTCFullYear();
  const mEnd = hoje.getUTCMonth() + 1;

  // Aluguel — mês a mês
  for (let y = yStart, m = mStart; y < yEnd || (y === yEnd && m <= mEnd); ) {
    const bruto = new Date(Date.UTC(y, m - 1, dia));
    const venc = proximoDiaUtil(bruto);
    parcelas.push({
      contrato_locacao_id: c.id,
      owner_admin_id: c.owner_admin_id,
      tipo: "aluguel",
      competencia: competenciaMes(y, m),
      vencimento: toIsoDate(venc),
      valor: c.valor_aluguel,
    });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }

  // IPTU — 1 por ano
  if (c.encargos_inquilino?.iptu) {
    for (let y = yStart; y <= yEnd; y++) {
      parcelas.push({
        contrato_locacao_id: c.id,
        owner_admin_id: c.owner_admin_id,
        tipo: "iptu",
        competencia: `${y}`,
        vencimento: toIsoDate(proximoDiaUtil(new Date(Date.UTC(y, 0, 15)))),
        valor: null,
      });
    }
  }
  return parcelas;
}

export const listPagamentosContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ contratoId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { data: contrato, error: eC } = await context.supabase
      .from("contratos_locacao")
      .select("id, owner_admin_id, data_inicio_vigencia, dia_vencimento, valor_aluguel, encargos_inquilino, inquilino_nome, status, prazo_meses, indice_reajuste, periodicidade_reajuste_meses, mes_base_reajuste, multa_mora_percent, juros_mora_mensal_percent, imoveis(descricao, endereco, edificio, numero_unidade, proprietarios(nome))")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (eC) throw new Error(eC.message);
    if (!contrato) throw new Error("Contrato não encontrado");

    // Geração idempotente (upsert por chave única).
    const esperadas = buildParcelasEsperadas(contrato as ContratoParaGerar);
    if (esperadas.length > 0) {
      const { error: eIns } = await context.supabase
        .from("pagamentos")
        .upsert(esperadas, {
          onConflict: "contrato_locacao_id,tipo,competencia",
          ignoreDuplicates: true,
        });
      if (eIns) throw new Error(eIns.message);
    }

    const { data: pagamentos, error: eP } = await context.supabase
      .from("pagamentos")
      .select("*")
      .eq("contrato_locacao_id", data.contratoId)
      .order("competencia", { ascending: false })
      .order("tipo", { ascending: true });
    if (eP) throw new Error(eP.message);
    return { contrato, pagamentos: pagamentos ?? [] };
  });

export const togglePagamento = createServerFn({ method: "POST" })
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
      .from("pagamentos")
      .update({
        pago: data.pago,
        data_pagamento: data.pago ? (data.data_pagamento ?? new Date().toISOString().slice(0, 10)) : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid(),
      valor: z.number().nullable().optional(),
      vencimento: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("pagamentos").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const criarPagamentoAvulso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      contrato_locacao_id: z.string().uuid(),
      tipo: z.enum(["aluguel", "condominio", "agua", "luz", "iptu", "tcr", "outro"]),
      competencia: z.string().min(4),
      vencimento: z.string().min(10),
      valor: z.number().nullable().optional(),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { error } = await context.supabase.from("pagamentos").insert({
      ...data,
      owner_admin_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Cálculo de mora (juros + multa) --------

export function calcularMora(
  valor: number,
  vencimento: string,
  hoje: Date,
  multaPercent: number,
  jurosMensalPercent: number,
): { diasAtraso: number; multa: number; juros: number; total: number } {
  const venc = new Date(vencimento + "T00:00:00Z");
  const diffMs = hoje.getTime() - venc.getTime();
  const dias = Math.max(0, Math.floor(diffMs / 86400000));
  if (dias === 0 || !valor) return { diasAtraso: 0, multa: 0, juros: 0, total: valor };
  const multa = valor * (multaPercent / 100);
  const juros = valor * (jurosMensalPercent / 100) * (dias / 30);
  return { diasAtraso: dias, multa, juros, total: valor + multa + juros };
}