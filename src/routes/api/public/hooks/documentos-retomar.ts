import { createFileRoute } from "@tanstack/react-router";

function tokenDaRequisicao(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return request.headers.get("x-cron-token") ?? request.headers.get("x-cron-secret") ?? bearer;
}

/**
 * Autoriza chamadas com o token de cron dos secrets OU com a chave interna
 * guardada em `cron_tokens` (só o servidor lê essa tabela).
 */
async function autorizado(request: Request): Promise<boolean> {
  const provided = tokenDaRequisicao(request);
  if (!provided) return false;
  const esperados = [process.env.CRON_SECRET, process.env.CRON_LEMBRETES_TOKEN].filter(
    (v): v is string => !!v,
  );
  if (esperados.includes(provided)) return true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cron_tokens")
      .select("token")
      .eq("nome", "documentos-retomar")
      .maybeSingle();
    return !!data?.token && data.token === provided;
  } catch {
    return false;
  }
}

// Cron: retoma documentos presos em "processando" (leitura interrompida).
export const Route = createFileRoute("/api/public/hooks/documentos-retomar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!autorizado(request)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ ok: false, error: "no_api_key" }, { status: 500 });
        try {
          const { retomarDocumentosParados } = await import("@/lib/documentos-processar.server");
          const r = await retomarDocumentosParados(apiKey);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          console.error("[documentos-retomar]", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
    },
  },
});
