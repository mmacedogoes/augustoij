import { createFileRoute } from "@tanstack/react-router";

/** Autoriza apenas chamadas com o token de cron configurado nos secrets. */
function autorizado(request: Request): boolean {
  const esperados = [process.env.CRON_SECRET, process.env.CRON_LEMBRETES_TOKEN].filter(
    (v): v is string => !!v,
  );
  if (esperados.length === 0) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const provided =
    request.headers.get("x-cron-token") ?? request.headers.get("x-cron-secret") ?? bearer ?? "";
  return !!provided && esperados.includes(provided);
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
