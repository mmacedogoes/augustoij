import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_documentos",
  title: "Listar documentos do condomínio",
  description:
    "Lista os documentos do acervo de um condomínio (convenção, regimento, atas, contratos) com o status de leitura.",
  inputSchema: {
    condominio_id: z.string().uuid().describe("Identificador do condomínio."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ condominio_id }, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("documentos")
      .select("id, titulo, nome_arquivo, tipo, status_processamento, created_at")
      .eq("condominio_id", condominio_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, documentos: data ?? [] });
  },
});
