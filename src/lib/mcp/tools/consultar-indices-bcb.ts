import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json } from "../supabase";

// Códigos das séries históricas oficiais no SGS do Banco Central do Brasil
const SERIES_BCB: Record<string, { codigo: number; nome: string; periodicidade: string }> = {
  ipca: { codigo: 433, nome: "IPCA (IBGE) - Variação Mensal", periodicidade: "mensal" },
  igpm: { codigo: 189, nome: "IGP-M (FGV) - Variação Mensal", periodicidade: "mensal" },
  inpc: { codigo: 188, nome: "INPC (IBGE) - Variação Mensal", periodicidade: "mensal" },
  selic: { codigo: 432, nome: "Meta Taxa Selic definida pelo Copom", periodicidade: "diaria" },
  cdi: { codigo: 12, nome: "Taxa de juros - CDI", periodicidade: "diaria" },
};

export interface DadoIndiceBcb {
  data: string;
  valor: number;
}

export interface RespostaIndiceBcb {
  indice: string;
  nomeSerie: string;
  codigoSerie: number;
  ultimosValores: DadoIndiceBcb[];
  acumulado12Meses?: number;
  fonte: string;
}

export async function consultarSerieBcb(
  indice: "ipca" | "igpm" | "inpc" | "selic" | "cdi",
  ultimosN: number = 12,
): Promise<RespostaIndiceBcb> {
  const meta = SERIES_BCB[indice];
  if (!meta) throw new Error(`Índice ${indice} não suportado.`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${meta.codigo}/dados/ultimos/${ultimosN}?formato=json`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AugustoIJ/1.0" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as Array<{ data: string; valor: string }>;
      const valores: DadoIndiceBcb[] = data.map((d) => ({
        data: d.data,
        valor: parseFloat(d.valor.replace(",", ".")),
      }));

      // Se for índice mensal (IPCA, IGP-M, INPC), calcula o acumulado composto de 12 meses
      let acumulado12Meses: number | undefined;
      if (["ipca", "igpm", "inpc"].includes(indice) && valores.length >= 12) {
        const ultimos12 = valores.slice(-12);
        let fator = 1.0;
        for (const v of ultimos12) {
          fator *= (1 + v.valor / 100);
        }
        acumulado12Meses = parseFloat(((fator - 1) * 100).toFixed(4));
      }

      return {
        indice,
        nomeSerie: meta.nome,
        codigoSerie: meta.codigo,
        ultimosValores: valores,
        acumulado12Meses,
        fonte: "Banco Central do Brasil (SGS)",
      };
    }
    throw new Error(`BCB retornou status ${res.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Falha ao consultar índice no Banco Central: ${(err as Error).message}`);
  }
}

export default defineTool({
  name: "consultar_indices_reajuste_bcb",
  title: "Consultar índices oficiais de reajuste (BCB)",
  description:
    "Consulta taxas oficiais e séries históricas do Banco Central do Brasil (IPCA, IGP-M, INPC, Selic, CDI) para cálculo de reajustes contratuais e simulação de correções monetárias.",
  inputSchema: {
    indice: z.enum(["ipca", "igpm", "inpc", "selic", "cdi"]).describe("Identificador do índice econômico."),
    ultimos_meses: z.number().int().min(1).max(36).default(12).optional().describe("Quantidade de meses/registros recentes a retornar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ indice, ultimos_meses }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    try {
      const dados = await consultarSerieBcb(indice, ultimos_meses ?? 12);
      return json({ sucesso: true, dados });
    } catch (e) {
      return erro((e as Error).message);
    }
  },
});
