import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_unidades",
  title: "Listar unidades de um condomínio",
  description:
    "Lista as unidades de um condomínio com bloco, número, tipo, fração ideal e área, conforme a convenção cadastrada.",
  inputSchema: {
    condominio_id: z.string().uuid().describe("Identificador do condomínio."),
    limite: z.number().int().min(1).max(500).optional().describe("Máximo de unidades (padrão 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ condominio_id, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("unidades")
      .select("id, bloco, numero, tipo, fracao_ideal, area_m2, vagas_garagem")
      .eq("condominio_id", condominio_id)
      .order("bloco", { nullsFirst: true })
      .order("numero")
      .limit(limite ?? 200);
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, unidades: data ?? [] });
  },
});
