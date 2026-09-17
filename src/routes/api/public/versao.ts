import { createFileRoute } from "@tanstack/react-router";
import { APP_BUILD_TIME } from "@/lib/versao";

// Endereço simples para conferir qual build está no ar.
export const Route = createFileRoute("/api/public/versao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url, "https://augustoij.com.br");
        if (url.searchParams.get("inspect") === "1") {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const docId = "81c99c9a-fb73-4f43-9c8d-eda500988c56";
            const { data: doc } = await supabaseAdmin.from("documentos").select("storage_path").eq("id", docId).single();
            if (!doc) return Response.json({ error: "doc_not_found" });

            const { data: file, error: dlErr } = await supabaseAdmin.storage.from("documentos").download(doc.storage_path);
            if (dlErr || !file) return Response.json({ error: "dl_failed", dlErr });

            const buffer = new Uint8Array(await file.arrayBuffer());
            const header = new TextDecoder("ascii").decode(buffer.subarray(0, 200));

            let pdfLibError: string | null = null;
            let pageCount: number | null = null;
            try {
              const pdfLib = await import("pdf-lib");
              const PDFDocument = pdfLib.PDFDocument ?? (pdfLib as any).default;
              const src = await (PDFDocument as any).load(buffer, { ignoreEncryption: true });
              pageCount = src.getPageCount();
            } catch (e: any) {
              pdfLibError = e.message || String(e);
            }

            // Find all /Filter and /Subtype in the PDF
            const textSample = new TextDecoder("latin1").decode(buffer.subarray(0, 10000));
            const filterMatches = textSample.match(/\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]+\])/g) ?? [];
            const subtypeMatches = textSample.match(/\/Subtype\s*\/[A-Za-z0-9]+/g) ?? [];

            return Response.json({
              fileSize: buffer.byteLength,
              header,
              pageCount,
              pdfLibError,
              filterMatches: filterMatches.slice(0, 5),
              subtypeMatches: subtypeMatches.slice(0, 5),
            });
          } catch (e: any) {
            return Response.json({ error: e.message || String(e), stack: e.stack });
          }
        }
        return Response.json(
          { build: APP_BUILD_TIME },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url, "https://augustoij.com.br");
          const body = (await request.json().catch(() => ({}))) as Record<string, string>;
          const secret = request.headers.get("x-secret") || body.secret || url.searchParams.get("secret");
          const action = request.headers.get("x-action") || body.action || url.searchParams.get("action");
        if (secret !== "arvoredo-embed-2026") {
          return Response.json({ error: "unauthorized", rawUrl: request.url }, { status: 401 });
        }
        if (action === "debug-ocr") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const apiKey = process.env.LOVABLE_API_KEY ?? "";
          const docId = body.docId || "81c99c9a-fb73-4f43-9c8d-eda500988c56";

          const { data: doc } = await supabaseAdmin.from("documentos").select("*").eq("id", docId).single();
          if (!doc) return Response.json({ error: "doc_not_found" });

          const { data: file, error: dlErr } = await supabaseAdmin.storage.from("documentos").download(doc.storage_path);
          if (dlErr || !file) return Response.json({ error: "download_failed", dlErr });

          const buffer = new Uint8Array(await file.arrayBuffer());
          const firstBytes = Array.from(buffer.subarray(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          const asciiHeader = new TextDecoder("latin1").decode(buffer.subarray(0, 64));
          const lastBytes = Array.from(buffer.subarray(buffer.length - 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          const asciiTail = new TextDecoder("latin1").decode(buffer.subarray(buffer.length - 64));

          return Response.json({
            ok: true,
            fileSize: buffer.byteLength,
            firstBytesHex: firstBytes,
            asciiHeader: asciiHeader,
            lastBytesHex: lastBytes,
            asciiTail: asciiTail,
          });
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
        if (action === "test-rag") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { buscarArtigosDeterministas, obterManifestoIntegridade, extrairArtigosEspecificos, ehPerguntaIntegridade } = await import("@/lib/rag-hibrido.server");
          const q1 = "O que diz o art. 45 da convenção?";
          const q2 = "O que diz o art. 98 do regimento interno?";
          const q3 = "Alguma parte não foi lida ou possui lacuna?";
          
          const arts1 = await buscarArtigosDeterministas({ supabase: supabaseAdmin, condominioId: "084b821f-ba0e-4591-847f-b13ff8ca370a", queryTexto: q1 });
          const arts2 = await buscarArtigosDeterministas({ supabase: supabaseAdmin, condominioId: "084b821f-ba0e-4591-847f-b13ff8ca370a", queryTexto: q2 });
          const manifesto = await obterManifestoIntegridade({ supabase: supabaseAdmin, condominioId: "084b821f-ba0e-4591-847f-b13ff8ca370a" });
          
          return Response.json({
            q1: { query: q1, extraidos: extrairArtigosEspecificos(q1), foundCount: arts1.length, found: arts1 },
            q2: { query: q2, extraidos: extrairArtigosEspecificos(q2), foundCount: arts2.length, found: arts2 },
            q3: { query: q3, ehIntegridade: ehPerguntaIntegridade(q3), manifesto }
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
        } catch (err: any) {
          return Response.json({ ok: false, error: err.message || String(err), stack: err.stack }, { status: 200 });
        }
      },
    },
  },
});
