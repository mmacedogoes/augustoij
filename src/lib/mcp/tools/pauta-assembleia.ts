import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_pauta_assembleia",
  title: "Obter pauta de uma assembleia",
  description:
    "Retorna os itens de pauta de uma assembleia (ordem, título, descrição, quórum e base de cálculo).",
  inputSchema: {
    assembleia_id: z.string().uuid().describe("Identificador da assembleia."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ assembleia_id }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("assembleia_itens")
      .select("id, ordem, titulo, descricao, regra_quorum, base_calculo, situacao")
      .eq("assembleia_id", assembleia_id)
      .order("ordem");
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, itens: data ?? [] });
  },
});
