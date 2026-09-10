import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json } from "../supabase";

export interface DadosCnpjReceita {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string;
  data_situacao_cadastral: string | null;
  cnae_fiscal_principal: {
    codigo: number;
    descricao: string;
  } | null;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  } | null;
  qsa?: Array<{
    nome_socio: string;
    qualificacao_socio: string;
  }>;
}

export async function consultarCnpjPublico(cnpjLimpo: string): Promise<DadosCnpjReceita> {
  const cnpjDigitos = cnpjLimpo.replace(/\D/g, "");
  if (cnpjDigitos.length !== 14) {
    throw new Error("CNPJ inválido. Forneça exatamente 14 dígitos.");
  }

  // Consulta prioritária via BrasilAPI com timeout seguro
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigitos}`, {
      signal: controller.signal,
      headers: { "User-Agent": "AugustoIJ/1.0" },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const d = (await res.json()) as Record<string, unknown>;
      return {
        cnpj: cnpjDigitos,
        razao_social: String(d.razao_social ?? d.nome ?? ""),
        nome_fantasia: d.nome_fantasia ? String(d.nome_fantasia) : null,
        situacao_cadastral: String(d.descricao_situacao_cadastral ?? d.situacao ?? "NÃO INFORMADA"),
        data_situacao_cadastral: d.data_situacao_cadastral ? String(d.data_situacao_cadastral) : null,
        cnae_fiscal_principal: d.cnae_fiscal
          ? {
              codigo: Number(d.cnae_fiscal),
              descricao: String(d.cnae_fiscal_descricao ?? ""),
            }
          : null,
        endereco: {
          logradouro: String(d.logradouro ?? ""),
          numero: String(d.numero ?? ""),
          bairro: String(d.bairro ?? ""),
          municipio: String(d.municipio ?? ""),
          uf: String(d.uf ?? ""),
          cep: String(d.cep ?? ""),
        },
        qsa: Array.isArray(d.qsa)
          ? d.qsa.map((s: Record<string, unknown>) => ({
              nome_socio: String(s.nome_socio ?? s.nome ?? ""),
              qualificacao_socio: String(s.qualificacao_socio ?? s.qualificacao ?? ""),
            }))
          : [],
      };
    }
    throw new Error(`Serviço da Receita retornou status ${res.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Não foi possível consultar os dados do CNPJ: ${(err as Error).message}`);
  }
}

export default defineTool({
  name: "consultar_cnpj_receita",
  title: "Consultar situação cadastral de CNPJ",
  description:
    "Consulta a situação cadastral oficial de uma empresa ou condomínio na Receita Federal (razão social, nome fantasia, status ativo/inapto/baixado, CNAE e quadro de sócios) para checagem de fornecedores e contratos.",
  inputSchema: {
    cnpj: z.string().trim().min(14).describe("Número do CNPJ da empresa ou condomínio (com ou sem pontuação)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ cnpj }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    try {
      const dados = await consultarCnpjPublico(cnpj);
      return json({ sucesso: true, dados });
    } catch (e) {
      return erro((e as Error).message);
    }
  },
});
