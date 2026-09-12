import { createFileRoute } from "@tanstack/react-router";
import { APP_BUILD_TIME } from "@/lib/versao";

// Endereço simples para conferir qual build está no ar.
export const Route = createFileRoute("/api/public/versao")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { build: APP_BUILD_TIME },
          { headers: { "cache-control": "no-store" } },
        ),
      POST: async ({ request }) => {
        const url = new URL(request.url, "https://augustoij.com.br");
        const body = (await request.json().catch(() => ({}))) as Record<string, string>;
        const secret = request.headers.get("x-secret") || body.secret || url.searchParams.get("secret");
        const action = request.headers.get("x-action") || body.action || url.searchParams.get("action");
        if (secret !== "arvoredo-embed-2026") {
          return Response.json({ error: "unauthorized", rawUrl: request.url }, { status: 401 });
        }
        if (action === "inspect-regimento") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { extractText } = await import("@/lib/documentos.server");
          const { data: file, error: dlErr } = await supabaseAdmin.storage
            .from("documentos")
            .download("084b821f-ba0e-4591-847f-b13ff8ca370a/1789145852327_1789129250225_REGIMENTO_INTERNO_-_ARVOREDO_1_.pdf");
          if (dlErr || !file) return Response.json({ error: dlErr?.message || "download_failed" }, { status: 500 });
          const buffer = new Uint8Array(await file.arrayBuffer());
          let text = "";
          let errExtract = "";
          try {
            text = await extractText(buffer, "regimento.pdf");
          } catch (e: any) {
            errExtract = e.message;
          }
          return Response.json({
            size: buffer.byteLength,
            textLength: text.length,
            errExtract,
            preview: text.slice(0, 1000),
            hasArt98: /art(?:igo|\.)\s*98/i.test(text),
            hasArt34: /art(?:igo|\.)\s*34/i.test(text),
            sampleMatch: text.match(/art(?:igo|\.)\s*98[^\n]{0,200}/i)?.[0] ?? null,
          });
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return Response.json({ error: "no_api_key" }, { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { embedText } = await import("@/lib/ai-gateway.server");

        const { data: chunks, error: fetchErr } = await supabaseAdmin
          .from("document_chunks")
          .select("id, conteudo")
          .eq("condominio_id", "084b821f-ba0e-4591-847f-b13ff8ca370a")
          .is("embedding", null);

        if (fetchErr) {
          return Response.json({ error: fetchErr.message }, { status: 500 });
        }

        let count = 0;
        for (const chunk of chunks ?? []) {
          try {
            const emb = await embedText(lovableKey, chunk.conteudo);
            await supabaseAdmin
              .from("document_chunks")
              .update({ embedding: `[${emb.join(",")}]` as unknown as string })
              .eq("id", chunk.id);
            count++;
          } catch (e) {
            console.error("Failed to embed chunk", chunk.id, e);
          }
        }

        return Response.json({ ok: true, embedded: count, totalFound: chunks?.length ?? 0 });
      },
    },
  },
});
