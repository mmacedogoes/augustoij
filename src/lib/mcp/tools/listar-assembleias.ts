import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_assembleias",
  title: "Listar assembleias",
  description:
    "Lista as assembleias de um condomínio com tipo, data/hora, local, modalidade e situação.",
  inputSchema: {
    condominio_id: z.string().uuid().describe("Identificador do condomínio."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ condominio_id }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("assembleias")
      .select("id, titulo, tipo, data_hora, local, modalidade, situacao, instalada_em, encerrada_em")
      .eq("condominio_id", condominio_id)
      .order("data_hora", { ascending: false })
      .limit(100);
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, assembleias: data ?? [] });
  },
});
