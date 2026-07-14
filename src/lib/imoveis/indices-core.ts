// Núcleo isomórfico da consulta de índices BCB: recebe um cliente Supabase
// autenticado e faz cache. Usado por múltiplos server fns.
import type { SupabaseClient } from "@supabase/supabase-js";

export const SERIES_BCB = { IGPM: 189, IPCA: 433, POUPANCA: 195 } as const;

export type Ponto = { ano: number; mes: number; valor: number };

function ddmmyyyy(y: number, m: number, d: number): string {
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function parseBcbData(s: string): { ano: number; mes: number } {
  const parts = s.split("/").map(Number);
  return { ano: parts[2], mes: parts[1] };
}

export async function fetchSerieBcb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: { serie: number; anoIni: number; mesIni: number; anoFim: number; mesFim: number },
): Promise<{ pontos: Ponto[]; erro: string | null }> {
  const { serie, anoIni, mesIni, anoFim, mesFim } = args;
  const chaves: Array<{ ano: number; mes: number }> = [];
  for (let y = anoIni, m = mesIni; y < anoFim || (y === anoFim && m <= mesFim); ) {
    chaves.push({ ano: y, mes: m });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }

  const { data: cached, error: eC } = await supabase
    .from("indices_bcb_cache")
    .select("ano, mes, valor")
    .eq("serie", serie)
    .gte("ano", anoIni)
    .lte("ano", anoFim);
  if (eC) throw new Error(eC.message);

  const map = new Map<string, number>();
  for (const r of cached ?? []) map.set(`${r.ano}-${r.mes}`, Number(r.valor));

  const faltando = chaves.filter((k) => !map.has(`${k.ano}-${k.mes}`));
  let erro: string | null = null;
  if (faltando.length > 0) {
    const dIni = ddmmyyyy(anoIni, mesIni, 1);
    const dFim = ddmmyyyy(anoFim, mesFim, ultimoDiaMes(anoFim, mesFim));
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${dIni}&dataFinal=${dFim}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`BCB retornou HTTP ${res.status}`);
      const apiRows = (await res.json()) as Array<{ data: string; valor: string }>;
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
        await supabase
          .from("indices_bcb_cache")
          .upsert(rowsToInsert, { onConflict: "serie,ano,mes", ignoreDuplicates: true });
      }
    } catch (e) {
      erro = (e as Error).message;
    }
  }

  const pontos: Ponto[] = chaves
    .filter((k) => map.has(`${k.ano}-${k.mes}`))
    .map((k) => ({ ano: k.ano, mes: k.mes, valor: map.get(`${k.ano}-${k.mes}`)! }));
  return { pontos, erro };
}

/** Acumula variações percentuais mensais: produto de (1 + v/100) - 1. */
export function acumularPercentualMensal(pontos: Array<{ valor: number }>): number {
  let acc = 1;
  for (const p of pontos) acc *= 1 + Number(p.valor) / 100;
  return (acc - 1) * 100;
}