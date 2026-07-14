import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ensureSuperAdmin } from "./guard";

// Códigos SGS/BCB:
//   189 = IGP-M (variação % mensal)
//   433 = IPCA (variação % mensal)
//   195 = Rendimento mensal da poupança (nova regra, desde 04/05/2012)
export const SERIES_BCB = { IGPM: 189, IPCA: 433, POUPANCA: 195 } as const;

type Ponto = { ano: number; mes: number; valor: number };

function ddmmyyyy(y: number, m: number, d: number): string {
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function parseBcbData(s: string): { ano: number; mes: number } {
  // BCB retorna "dd/mm/aaaa"
  const [d, m, a] = s.split("/").map(Number);
  void d;
  return { ano: a, mes: m };
}

/**
 * Consulta pontos mensais de uma série BCB entre (anoIni, mesIni) e (anoFim, mesFim),
 * usando cache em `indices_bcb_cache`.
 */
export const consultarSerieBcb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        serie: z.number().int(),
        anoIni: z.number().int(),
        mesIni: z.number().int().min(1).max(12),
        anoFim: z.number().int(),
        mesFim: z.number().int().min(1).max(12),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { serie, anoIni, mesIni, anoFim, mesFim } = data;

    // Enumera meses solicitados.
    const chaves: Array<{ ano: number; mes: number }> = [];
    for (let y = anoIni, m = mesIni; y < anoFim || (y === anoFim && m <= mesFim); ) {
      chaves.push({ ano: y, mes: m });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }

    // Busca cache existente.
    const { data: cached, error: eC } = await context.supabase
      .from("indices_bcb_cache")
      .select("ano, mes, valor")
      .eq("serie", serie)
      .gte("ano", anoIni)
      .lte("ano", anoFim);
    if (eC) throw new Error(eC.message);

    const map = new Map<string, number>();
    for (const r of cached ?? []) map.set(`${r.ano}-${r.mes}`, Number(r.valor));

    const faltando = chaves.filter((k) => !map.has(`${k.ano}-${k.mes}`));
    if (faltando.length > 0) {
      const dIni = ddmmyyyy(anoIni, mesIni, 1);
      const dFim = ddmmyyyy(anoFim, mesFim, ultimoDiaMes(anoFim, mesFim));
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${dIni}&dataFinal=${dFim}`;
      let apiRows: Array<{ data: string; valor: string }> = [];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`BCB retornou HTTP ${res.status}`);
        apiRows = (await res.json()) as Array<{ data: string; valor: string }>;
      } catch (e) {
        // API falhou — retorna o que temos em cache, o usuário pode editar manualmente.
        const pontos: Ponto[] = chaves
          .filter((k) => map.has(`${k.ano}-${k.mes}`))
          .map((k) => ({ ano: k.ano, mes: k.mes, valor: map.get(`${k.ano}-${k.mes}`)! }));
        return { pontos, erro: (e as Error).message };
      }
      const rowsToInsert: Array<{ serie: number; ano: number; mes: number; valor: number }> = [];
      for (const r of apiRows) {
        const { ano, mes } = parseBcbData(r.data);
        const valor = Number(r.valor.replace(",", "."));
        if (Number.isFinite(valor)) {
          map.set(`${ano}-${mes}`, valor);
          rowsToInsert.push({ serie, ano, mes, valor });
        }
      }
      if (rowsToInsert.length > 0) {
        await context.supabase
          .from("indices_bcb_cache")
          .upsert(rowsToInsert, { onConflict: "serie,ano,mes", ignoreDuplicates: true });
      }
    }

    const pontos: Ponto[] = chaves
      .filter((k) => map.has(`${k.ano}-${k.mes}`))
      .map((k) => ({ ano: k.ano, mes: k.mes, valor: map.get(`${k.ano}-${k.mes}`)! }));
    return { pontos, erro: null };
  });

/** Acumula variações percentuais mensais: produto de (1 + v/100) - 1. */
export function acumularPercentualMensal(pontos: Array<{ valor: number }>): number {
  let acc = 1;
  for (const p of pontos) acc *= 1 + Number(p.valor) / 100;
  return (acc - 1) * 100;
}