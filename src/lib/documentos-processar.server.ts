import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documentos";

/** Orçamento de tempo de uma rodada (o restante fica para a próxima chamada). */
const ORCAMENTO_MS = 45_000;

export type ResultadoProcessamento = {
  ok: true;
  /** Falso quando ainda há blocos pendentes — a UI chama outra rodada. */
  concluido: boolean;
  chunks: number;
  mode: "vision" | "text";
  totalPaginas: number;
  paginasLidas: number;
  paginasFalhas: number[];
  blocosProntos: number;
  totalBlocos: number;
  aviso: string | null;
};

type DocRow = {
  id: string;
  condominio_id: string;
  storage_path: string;
  nome_arquivo: string;
  tipo: string;
};

/**
 * Lê, transcreve (OCR por visão quando necessário) e indexa um documento.
 *
 * Documentos escaneados longos são lidos em BLOCOS de páginas e cada bloco é
 * gravado assim que fica pronto (o índice do bloco vai em
 * `document_chunks.metadata.bloco`). Como cada bloco leva ~30 s no gateway,
 * uma única requisição não daria conta de dezenas de páginas: a função
 * processa o que couber no orçamento de tempo e devolve `concluido: false`,
 * permitindo que a próxima rodada retome exatamente de onde parou.
 */
export async function processarDocumentoCore(
  supabase: SupabaseClient,
  userId: string,
  documentoId: string,
  apiKey: string,
): Promise<ResultadoProcessamento> {
  const inicio = Date.now();
  const { data: doc, error: errGet } = await supabase
    .from("documentos")
    .select("id, condominio_id, storage_path, nome_arquivo, tipo")
    .eq("id", documentoId)
    .maybeSingle();
  if (errGet) throw new Error(errGet.message);
  if (!doc) throw new Error("Documento não encontrado");
  const documento = doc as DocRow;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { embedChunksParallel } = await import("./ai-gateway.server");
  const { extractText, prepararBlocosOcr, ocrBloco, chunkText, OCR_CONCORRENCIA } =
    await import("./documentos.server");
  const { humanizeIngestError, IngestError } = await import("./ingest-errors");

  const indexar = async (
    textos: string[],
    metaBase: Record<string, string | number>,
  ): Promise<number> => {
    const chunks = textos.flatMap((t) => chunkText(t));
    if (chunks.length === 0) {
      throw new IngestError(
        "chunking",
        "O bloco foi lido, mas não produziu nenhum trecho utilizável",
        "Tente reler o documento; se persistir, verifique a qualidade das páginas indicadas.",
      );
    }
    const { embeddings, totalTokens } = await embedChunksParallel(apiKey, chunks, 5);
    const blocoBase = typeof metaBase.bloco === "number" ? metaBase.bloco * 100_000 : 0;
    const rows = chunks.map((c, i) => ({
      condominio_id: documento.condominio_id,
      documento_id: documento.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
      metadata: { ...metaBase, trecho: i, ordem_global: blocoBase + i },
    }));
    const bloco = typeof metaBase.bloco === "number" ? metaBase.bloco : null;
    if (bloco != null) {
      await supabaseAdmin
        .from("document_chunks")
        .delete()
        .eq("documento_id", documento.id)
        .contains("metadata", { bloco });
    }
    try {
      for (let i = 0; i < rows.length; i += 50) {
        const { error: insErr } = await supabaseAdmin
          .from("document_chunks")
          .insert(rows.slice(i, i + 50));
        if (insErr) {
          throw new IngestError(
            "indexacao",
            "Falha ao salvar os trechos indexados",
            "Tente reprocessar o documento.",
            insErr.message,
          );
        }
      }
    } catch (error) {
      if (bloco != null) {
        await supabaseAdmin
          .from("document_chunks")
          .delete()
          .eq("documento_id", documento.id)
          .contains("metadata", { bloco });
      }
      throw error;
    }
    try {
      const { registrarEventoIa } = await import("./uso-ia.server");
      const { EMBEDDING_MODEL } = await import("./ai-gateway.server");
      await registrarEventoIa({
        userId,
        condominioId: documento.condominio_id,
        origem: "embedding_documento",
        model: EMBEDDING_MODEL,
        tokensInput: totalTokens,
        meta: {
          documento_id: documento.id,
          chunks: chunks.length,
          arquivo: documento.nome_arquivo,
        },
      });
    } catch (err) {
      console.error("[uso-ia] indexar:", err);
    }
    return chunks.length;
  };

  const finalizar = async (
    concluido: boolean,
    meta: Record<string, string | number | boolean | number[] | null>,
  ) => {
    await supabaseAdmin
      .from("documentos")
      .update({
        status_processamento: concluido ? "pronto" : "processando",
        processamento_meta: {
          ...meta,
          etapa: concluido ? "interpretacao_unidades" : "ocr",
          atualizado_em: new Date().toISOString(),
        },
      })
      .eq("id", documento.id);
    if (concluido && documento.tipo === "convencao") {
      try {
        const { extrairESalvarSugestaoUnidades } = await import("./unidades-extracao.server");
        await extrairESalvarSugestaoUnidades(supabaseAdmin, documento.id, apiKey, { force: true });
      } catch (autoErr) {
        console.error("[processarDocumentoCore] auto-extração de unidades falhou", autoErr);
        const mensagem =
          autoErr instanceof Error ? autoErr.message : "Falha ao interpretar as unidades.";
        await supabaseAdmin
          .from("documentos")
          .update({
            processamento_meta: {
              ...meta,
              etapa: "interpretacao_unidades",
              extracao_status: "falhou",
              mensagem,
              atualizado_em: new Date().toISOString(),
            },
          })
          .eq("id", documento.id);
      }
    }
  };

  try {
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(documento.storage_path);
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

    // 1) Caminho rápido: documento com camada de texto.
    let texto = "";
    try {
      texto = await extractText(buffer, documento.nome_arquivo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "__NEEDS_VISION__") throw err;
    }
    if (texto.trim()) {
      await supabaseAdmin.from("document_chunks").delete().eq("documento_id", documento.id);
      const n = await indexar([texto], { origem: "texto" });
      await finalizar(true, {
        modo: "texto",
        chunks: n,
        blocos_prontos: 1,
        total_blocos: 1,
        paginas_falhas: [],
        aviso: null,
      });
      return {
        ok: true,
        concluido: true,
        chunks: n,
        mode: "text",
        totalPaginas: 0,
        paginasLidas: 0,
        paginasFalhas: [],
        blocosProntos: 1,
        totalBlocos: 1,
        aviso: null,
      };
    }

    // 2) OCR por blocos, retomável.
    const { mime, totalPaginas, blocos } = await prepararBlocosOcr(buffer, documento.nome_arquivo);
    const { data: existentes } = await supabaseAdmin
      .from("document_chunks")
      .select("metadata")
      .eq("documento_id", documento.id);
    const prontos = new Set<number>();
    for (const r of (existentes ?? []) as Array<{ metadata: { bloco?: number } | null }>) {
      const b = r.metadata?.bloco;
      if (typeof b === "number") prontos.add(b);
    }

    const pendentes = blocos.filter((b) => !prontos.has(b.indice));
    const falhas: number[] = [];
    let novosChunks = 0;
    let cursor = 0;
    let semTempo = false;

    const worker = async () => {
      for (;;) {
        if (Date.now() - inicio > ORCAMENTO_MS) {
          semTempo = true;
          return;
        }
        const idx = cursor++;
        if (idx >= pendentes.length) return;
        const bloco = pendentes[idx];
        try {
          const txt = await ocrBloco(
            apiKey,
            `${documento.nome_arquivo} (p. ${bloco.inicio}-${bloco.fim})`,
            mime,
            bloco.bytes,
          );
          if (!txt.trim()) {
            for (let p = bloco.inicio; p <= bloco.fim; p++) falhas.push(p);
            continue;
          }
          novosChunks += await indexar([txt], {
            origem: "ocr",
            bloco: bloco.indice,
            pagina_inicio: bloco.inicio,
            pagina_fim: bloco.fim,
          });
          prontos.add(bloco.indice);
        } catch (err) {
          console.warn(`[ocr] bloco ${bloco.inicio}-${bloco.fim} falhou`, err);
          for (let p = bloco.inicio; p <= bloco.fim; p++) falhas.push(p);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(OCR_CONCORRENCIA, Math.max(1, pendentes.length)) }, () =>
        worker(),
      ),
    );

    const blocosProntos = prontos.size;
    if (blocosProntos === 0) {
      throw new IngestError(
        "ocr",
        "Não foi possível ler o conteúdo visual do documento",
        "Verifique se a digitalização está legível e tente novamente.",
      );
    }

    const restantes = blocos.filter((b) => !prontos.has(b.indice));
    // Só é definitivo quando não sobrou bloco algum. Se ainda há pendentes
    // (falta de tempo ou falhas transitórias), a próxima rodada retoma.
    const concluido = restantes.length === 0;
    falhas.sort((a, b) => a - b);
    const paginasPendentes = restantes.reduce((acc, b) => acc + (b.fim - b.inicio + 1), 0);
    await finalizar(concluido, {
      modo: "ocr",
      chunks_novos: novosChunks,
      total_paginas: totalPaginas,
      blocos_prontos: blocosProntos,
      total_blocos: blocos.length,
      paginas_falhas: falhas,
      aviso: concluido
        ? null
        : semTempo
          ? `Leitura em andamento: ${blocosProntos} de ${blocos.length} bloco(s) concluído(s).`
          : `${paginasPendentes} página(s) ainda não puderam ser lidas.`,
    });

    return {
      ok: true,
      concluido,
      chunks: novosChunks,
      mode: "vision",
      totalPaginas,
      paginasLidas: Math.max(0, totalPaginas - paginasPendentes),
      paginasFalhas: falhas,
      blocosProntos,
      totalBlocos: blocos.length,
      aviso: concluido
        ? null
        : semTempo
          ? `Leitura em andamento: ${blocosProntos} de ${blocos.length} bloco(s) concluído(s). Continue a releitura para ler o restante.`
          : `${paginasPendentes} página(s) ainda não puderam ser lidas. Tente continuar a releitura.`,
    };
  } catch (e) {
    const ing = humanizeIngestError(e, "leitura");
    await supabaseAdmin
      .from("documentos")
      .update({
        status_processamento: ing.toStatus(),
        processamento_meta: {
          etapa: ing.stage,
          mensagem: ing.toHuman(),
          detalhe_tecnico: ing.technical,
          atualizado_em: new Date().toISOString(),
        },
      })
      .eq("id", documento.id);
    throw new Error(ing.toHuman());
  }
}

/** Limpa os trechos indexados antes de uma releitura do zero. */
export async function limparChunks(documentoId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("document_chunks").delete().eq("documento_id", documentoId);
  await supabaseAdmin
    .from("documentos")
    .update({
      status_processamento: "processando",
      processamento_meta: {
        etapa: "reiniciando",
        mensagem: null,
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", documentoId);
}
