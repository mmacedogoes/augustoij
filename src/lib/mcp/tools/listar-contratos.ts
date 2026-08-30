import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_contratos_servico",
  title: "Listar contratos de prestação de serviços",
  description:
    "Lista os contratos de prestação de serviços de um condomínio: prestador, objeto, vigência, valor e situação.",
  inputSchema: {
    condominio_id: z.string().uuid().describe("Identificador do condomínio."),
    situacao: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Filtro opcional pela situação do contrato (ex.: vigente, encerrado)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ condominio_id, situacao }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("contratos_servico")
      .select(
        "id, prestador_nome, objeto, situacao, data_inicio, data_fim, prazo_indeterminado, valor, tipo_valor, dia_vencimento",
      )
      .eq("condominio_id", condominio_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (situacao) q = q.eq("situacao", situacao);
    const { data, error } = await q;
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, contratos: data ?? [] });
  },
});
