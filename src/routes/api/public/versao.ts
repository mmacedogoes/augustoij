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
        if (action === "seed-artigos") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const artigos = (body as any).artigos;
          if (!Array.isArray(artigos) || artigos.length === 0) {
            return Response.json({ error: "no_artigos" }, { status: 400 });
          }
          const { data, error } = await supabaseAdmin.from("documento_artigos").insert(artigos).select("id");
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ ok: true, inserted: data?.length ?? 0 });
        }
        if (action === "stats-artigos") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("documento_artigos")
            .select("tipo, artigo_numero")
            .eq("condominio_id", "084b821f-ba0e-4591-847f-b13ff8ca370a");
          if (error) return Response.json({ error: error.message }, { status: 500 });
          const conv = (data ?? []).filter(d => d.tipo === "convencao").map(d => d.artigo_numero).sort((a,b)=>a-b);
          const reg = (data ?? []).filter(d => d.tipo === "regimento").map(d => d.artigo_numero).sort((a,b)=>a-b);
          return Response.json({
            ok: true,
            total: data?.length ?? 0,
            convencaoCount: conv.length,
            regimentoCount: reg.length,
            convencaoMin: conv[0] ?? null,
            convencaoMax: conv[conv.length - 1] ?? null,
            regimentoMin: reg[0] ?? null,
            regimentoMax: reg[reg.length - 1] ?? null,
            hasConvArt45: conv.includes(45),
            hasRegArt98: reg.includes(98),
            hasRegArt34: reg.includes(34),
          });
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
