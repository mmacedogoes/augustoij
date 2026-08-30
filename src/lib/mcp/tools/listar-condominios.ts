import { defineTool } from "@lovable.dev/mcp-js";
import { erro, json, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_condominios",
  title: "Listar condomínios",
  description:
    "Lista os condomínios acessíveis ao usuário conectado (nome, cidade/UF, categoria e identificador).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return erro("Não autenticado.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("condominios")
      .select("id, nome, cidade, uf, categoria, qtd_unidades, created_at")
      .order("nome");
    if (error) return erro(error.message);
    return json({ total: data?.length ?? 0, condominios: data ?? [] });
  },
});
