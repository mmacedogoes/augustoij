import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "documentos";

/** Orçamento de tempo de uma rodada (1 bloco por rodada para evitar timeout do Cloudflare/Edge). */
const ORCAMENTO_MS = 10_000;

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
    .select("id, condominio_id, storage_path, nome_arquivo, tipo, processamento_meta")
    .eq("id", documentoId)
    .maybeSingle();
  if (errGet) throw new Error(errGet.message);
  if (!doc) throw new Error("Documento não encontrado");
  const documento = doc as DocRow;
  const metaAnterior = ((doc as { processamento_meta?: Record<string, unknown> | null })
    .processamento_meta ?? {}) as Record<string, unknown>;
  const tentativas = (typeof metaAnterior.tentativas === "number" ? metaAnterior.tentativas : 0) + 1;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Marca o início da rodada ANTES de qualquer trabalho pesado: se a chamada
  // morrer no meio (aba fechada, timeout do edge), o documento não fica sem
  // rastro e a retomada automática sabe que já houve tentativa.
  await supabaseAdmin
    .from("documentos")
    .update({
      status_processamento: "processando",
      processamento_meta: {
        ...metaAnterior,
        etapa: "lendo",
        tentativas,
        travado_ate: new Date(Date.now() + 3 * 60_000).toISOString(),
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", documento.id);
  const { embedChunksParallel } = await import("./ai-gateway.server");
  const { extractText, prepararPlanoOcr, ocrBloco, chunkText } =
    await import("./documentos.server");
  // Um bloco por vez: sub-PDF + base64 simultâneos estouravam a memória do runtime.
  const OCR_CONCORRENCIA = 1;

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
    // O título "BLOCO A"/"TORRE B" vigente é propriedade da ordem de leitura.
    const { REGEX_TITULO_BLOCO } = await import("./censo-linhas");
    let blocoContexto: string | null = null;
    const contextos = chunks.map((c) => {
      for (const linha of c.split("\n")) {
        const titulo = REGEX_TITULO_BLOCO.exec(linha);
        if (titulo && !/^\s*\|/.test(linha)) blocoContexto = titulo[1].toUpperCase();
      }
      return blocoContexto;
    });
    const rows = chunks.map((c, i) => ({
      condominio_id: documento.condominio_id,
      documento_id: documento.id,
      conteudo: c,
      embedding: `[${embeddings[i].join(",")}]`,
      metadata: { ...metaBase, trecho: i, ordem_global: blocoBase + i, bloco_contexto: contextos[i] },
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
          etapa: "embedding",

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
    // Quando a rodada avançou (leu blocos novos), o contador de tentativas
    // volta a zero: só rodadas sem avanço algum podem levar ao erro definitivo.
    avancou = false,
  ) => {
    await supabaseAdmin
      .from("documentos")
      .update({
        status_processamento: concluido ? "pronto" : "processando",
        processamento_meta: {
          ...meta,
          etapa: concluido ? "interpretacao_unidades" : "ocr",
          tentativas: avancou ? 0 : tentativas,
          travado_ate: null,
          indexado_em: concluido ? new Date().toISOString() : null,
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
      if (msg !== "__NEEDS_VISION__") {
        console.warn(
          "[processarDocumentoCore] Falha na extração de texto direto, acionando OCR visão:",
          msg,
        );
      }
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
    const {
      mime,
      totalPaginas,
      blocos,
      gerarBloco,
    } = await prepararPlanoOcr(buffer, documento.nome_arquivo);
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
    let ultimoErroOcr: string | null = null;

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
          const bytes = await gerarBloco(bloco.indice);
          const txt = await ocrBloco(
            apiKey,
            `${documento.nome_arquivo} (p. ${bloco.inicio}-${bloco.fim})`,
            mime,
            bytes,
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
          ultimoErroOcr = err instanceof Error ? err.message : String(err);
          console.warn(`[ocr] bloco ${bloco.inicio}-${bloco.fim} falhou:`, ultimoErroOcr);
          for (let p = bloco.inicio; p <= bloco.fim; p++) falhas.push(p);
        }

        // Retorna imediatamente após cada bloco processado para que o navegador
        // receba a resposta HTTP em menos de 8s e exiba a barra de progresso em tempo real
        if (cursor < pendentes.length) {
          semTempo = true;
          return;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(OCR_CONCORRENCIA, Math.max(1, pendentes.length)) }, () =>
        worker(),
      ),
    );

    const blocosProntos = prontos.size;
    try {
      const { registrarEventoIa } = await import("./uso-ia.server");
      await registrarEventoIa({
        userId,
        condominioId: documento.condominio_id,
        origem: "ocr_visao_documento",
        model: "ocr",
        meta: {
          etapa: "ocr",
          documento_id: documento.id,
          total_paginas: totalPaginas,
          blocos_lidos: blocosProntos,
          paginas_falhas: falhas.length,
          duracao_ms: Date.now() - inicio,
        },
      });
    } catch (err) {
      console.error("[uso-ia] ocr:", err);
    }

    if (blocosProntos === 0 && !semTempo && pendentes.length > 0 && falhas.length >= pendentes.length) {
      throw new IngestError(
        "ocr",
        "Não foi possível ler o conteúdo visual do documento",
        ultimoErroOcr ?? "Verifique se a digitalização está legível e tente novamente.",
        ultimoErroOcr ?? "",
      );
    }

    // Rodada sem nenhum trecho novo e com bloco falhando: em vez de deixar o
    // documento preso em "processando" para sempre, marcamos erro legível
    // depois de algumas tentativas seguidas sem avanço.
    if (novosChunks === 0 && falhas.length > 0 && tentativas >= 3) {
      throw new IngestError(
        "ocr",
        "A leitura das páginas escaneadas falhou repetidamente",
        ultimoErroOcr ??
          "As páginas indicadas não puderam ser lidas. Verifique a qualidade do arquivo e reenvie.",
        ultimoErroOcr ?? "",
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
    }, novosChunks > 0);

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
          tentativas,
          travado_ate: null,
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
        tentativas: 0,
        travado_ate: null,
        atualizado_em: new Date().toISOString(),
      },
    })
    .eq("id", documentoId);
}

/** Limite de tentativas sem qualquer avanço antes de declarar erro. */
const MAX_TENTATIVAS = 12;

type RetomadaItem = {
  id: string;
  nome: string;
  resultado: "concluido" | "avancou" | "erro" | "ignorado";
  detalhe?: string;
};

/**
 * Retoma, no servidor, documentos que ficaram presos em "processando".
 *
 * A leitura por blocos era conduzida apenas pela aba do navegador: se o
 * usuário saísse da página o documento ficava eternamente "processando".
 * Esta rotina roda por cron e continua de onde parou.
 */
export async function retomarDocumentosParados(
  apiKey: string,
  opts?: { limite?: number; minutosParado?: number; orcamentoMs?: number; documentoId?: string },
): Promise<{ verificados: number; itens: RetomadaItem[] }> {
  const limite = opts?.limite ?? 5;
  const minutos = opts?.minutosParado ?? 3;
  const orcamento = opts?.orcamentoMs ?? 240_000;
  const inicioGeral = Date.now();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let q = supabaseAdmin
    .from("documentos")
    .select("id, nome_arquivo, condominio_id, created_at, processamento_meta")
    .eq("status_processamento", "processando")
    .order("created_at", { ascending: true })
    .limit(limite * 4);
  if (opts?.documentoId) q = q.eq("id", opts.documentoId);

  const { data: candidatos, error } = await q;
  if (error) throw new Error(error.message);

  const corte = Date.now() - minutos * 60_000;
  const parados = (candidatos ?? [])
    .filter((d) => {
      const meta = (d.processamento_meta ?? {}) as Record<string, unknown>;
      if (opts?.documentoId) return true;
      const travado = typeof meta.travado_ate === "string" ? Date.parse(meta.travado_ate) : 0;
      if (travado && travado > Date.now()) return false; // outra execução está cuidando
      const ref =
        typeof meta.atualizado_em === "string"
          ? Date.parse(meta.atualizado_em)
          : Date.parse(d.created_at as string);
      return !ref || ref < corte;
    })
    .slice(0, limite);

  const itens: RetomadaItem[] = [];

  for (const doc of parados) {
    if (Date.now() - inicioGeral > orcamento) break;
    const meta = (doc.processamento_meta ?? {}) as Record<string, unknown>;
    const tentativas = typeof meta.tentativas === "number" ? meta.tentativas : 0;
    if (tentativas >= MAX_TENTATIVAS) {
      await supabaseAdmin
        .from("documentos")
        .update({
          status_processamento: "erro",
          processamento_meta: {
            ...meta,
            etapa: "leitura",
            travado_ate: null,
            mensagem:
              "A leitura foi tentada várias vezes sem avançar. Verifique a qualidade do arquivo e envie novamente.",
            atualizado_em: new Date().toISOString(),
          },
        })
        .eq("id", doc.id);
      itens.push({ id: doc.id, nome: doc.nome_arquivo, resultado: "erro", detalhe: "sem avanço" });
      continue;
    }

    // Usa o dono do condomínio apenas para atribuir o consumo de IA.
    const { data: cond } = await supabaseAdmin
      .from("condominios")
      .select("owner_id")
      .eq("id", doc.condominio_id)
      .maybeSingle();
    const userId = (cond?.owner_id as string | undefined) ?? "";

    try {
      let r = await processarDocumentoCore(supabaseAdmin, userId, doc.id, apiKey);
      let anterior = -1;
      while (
        !r.concluido &&
        r.blocosProntos > anterior &&
        Date.now() - inicioGeral < orcamento
      ) {
        anterior = r.blocosProntos;
        r = await processarDocumentoCore(supabaseAdmin, userId, doc.id, apiKey);
      }
      itens.push({
        id: doc.id,
        nome: doc.nome_arquivo,
        resultado: r.concluido ? "concluido" : "avancou",
        detalhe: `${r.blocosProntos}/${r.totalBlocos} bloco(s)`,
      });
    } catch (e) {
      itens.push({
        id: doc.id,
        nome: doc.nome_arquivo,
        resultado: "erro",
        detalhe: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { verificados: parados.length, itens };
}
