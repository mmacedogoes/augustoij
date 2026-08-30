import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documentos";

export type ResultadoProcessamento = {
  ok: true;
  chunks: number;
  mode: "vision" | "text";
  totalPaginas: number;
  paginasFalhas: number[];
  aviso: string | null;
};

/**
 * Lê, transcreve (OCR por visão quando necessário) e indexa um documento.
 * Compartilhado por `processDocumento` e `reprocessarDocumento`.
 */
export async function processarDocumentoCore(
  supabase: SupabaseClient,
  userId: string,
  documentoId: string,
  apiKey: string,
): Promise<ResultadoProcessamento> {
  const { data: doc, error: errGet } = await supabase
    .from("documentos")
    .select("id, condominio_id, storage_path, nome_arquivo, tipo")
    .eq("id", documentoId)
    .maybeSingle();
  if (errGet) throw new Error(errGet.message);
  if (!doc) throw new Error("Documento não encontrado");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { embedChunksParallel } = await import("./ai-gateway.server");
  const { extractText, extractTextWithVisionDetalhado, chunkText } = await import(
    "./documentos.server"
  );
  const { humanizeIngestError, IngestError } = await import("./ingest-errors");

  try {
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(doc.storage_path);
    if (dlErr || !file) {
      throw new IngestError(
        "upload",
        "Falha ao baixar o arquivo do storage",
        "Reenvie o documento.",
        dlErr?.message ?? "",
      );
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new IngestError(
        "upload",
        "Arquivo armazenado está vazio (0 bytes)",
        "O upload falhou ou o arquivo original está vazio. Reenvie o documento.",
      );
    }

    let text = "";
    let usedVision = false;
    let paginasFalhas: number[] = [];
    let totalPaginas = 0;
    try {
      text = await extractText(buffer, doc.nome_arquivo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "__NEEDS_VISION__") throw err;
      usedVision = true;
      const r = await extractTextWithVisionDetalhado(apiKey, buffer, doc.nome_arquivo);
      text = r.texto;
      paginasFalhas = r.paginasFalhas;
      totalPaginas = r.totalPaginas;
    }
    if (!text.trim()) {
      throw new IngestError(
        "ocr",
        "Não foi possível ler o conteúdo do documento",
        "Verifique se a digitalização está legível e tente novamente.",
      );
    }

    const chunks = chunkText(text);

    const { embeddings, totalTokens: embTokens } = await embedChunksParallel(apiKey, chunks, 5);
    try {
      const { registrarEventoIa } = await import("./uso-ia.server");
      const { EMBEDDING_MODEL } = await import("./ai-gateway.server");
      await registrarEventoIa({
        userId,
        condominioId: doc.condominio_id,
        origem: "embedding_documento",
        model: EMBEDDING_MODEL,
        tokensInput: embTokens,
        meta: { documento_id: doc.id, chunks: chunks.length, arquivo: doc.nome_arquivo },
      });
      if (usedVision) {
        await registrarEventoIa({
          userId,
          condominioId: doc.condominio_id,
          origem: "ocr_visao_documento",
          model: "google/gemini-3.7-flash",
          tokensOutput: Math.ceil(text.length / 4),
          meta: {
            documento_id: doc.id,
            arquivo: doc.nome_arquivo,
            paginas: totalPaginas,
            paginas_falhas: paginasFalhas.length,
          },
        });
      }
    } catch (err) {
      console.error("[uso-ia] processarDocumentoCore:", err);
    }

    const rows = chunks.map((c, i) => ({
      condominio_id: doc.condominio_id,
      documento_id: doc.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error: insErr } = await supabaseAdmin.from("document_chunks").insert(slice);
      if (insErr) {
        throw new IngestError(
          "indexacao",
          "Falha ao salvar os trechos indexados",
          "Tente reprocessar o documento.",
          insErr.message,
        );
      }
    }

    await supabaseAdmin
      .from("documentos")
      .update({ status_processamento: "pronto" })
      .eq("id", doc.id);

    // Auto-extração de unidades quando o documento é a convenção (best-effort).
    if (doc.tipo === "convencao") {
      try {
        const { _extrairESalvarSugestaoUnidades } = await import("./unidades-ia.functions");
        await _extrairESalvarSugestaoUnidades(supabase, doc.id, apiKey, { force: true });
      } catch (autoErr) {
        console.warn("[processarDocumentoCore] auto-extração de unidades falhou", autoErr);
      }
    }

    return {
      ok: true,
      chunks: chunks.length,
      mode: usedVision ? "vision" : "text",
      totalPaginas,
      paginasFalhas,
      aviso:
        paginasFalhas.length > 0
          ? `${paginasFalhas.length} de ${totalPaginas} página(s) não puderam ser lidas (${paginasFalhas
              .slice(0, 10)
              .join(", ")}${paginasFalhas.length > 10 ? "…" : ""}). O restante do documento foi indexado.`
          : null,
    };
  } catch (e) {
    const ing = humanizeIngestError(e, "leitura");
    await supabaseAdmin
      .from("documentos")
      .update({ status_processamento: ing.toStatus() })
      .eq("id", doc.id);
    throw new Error(ing.toHuman());
  }
}

/** Limpa os trechos indexados antes de uma releitura. */
export async function limparChunks(documentoId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("document_chunks").delete().eq("documento_id", documentoId);
  await supabaseAdmin
    .from("documentos")
    .update({ status_processamento: "processando" })
    .eq("id", documentoId);
}
