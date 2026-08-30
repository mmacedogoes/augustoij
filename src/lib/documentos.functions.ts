import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { PLANOS, type PlanoId as PlanoIdV2 } from "@/config/planos";
import { resolvePlanId, isTrialExpired, gateMessages, efetivoPlanoId } from "@/lib/plan-gates";
import { isAdminInternoServer } from "@/lib/admin-bypass";

/**
 * Verifica se o usuário logado pode enviar mais um documento no condomínio
 * (aplicado tanto em getUploadUrl quanto em createDocumento).
 */
async function assertUploadPermitido(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  condominioId: string,
  tipo?: string,
) {
  const { getSubscriptionEfetiva } = await import("@/lib/conta-master.server");
  const [sub, docsRes, admin] = await Promise.all([
    getSubscriptionEfetiva(userId),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", condominioId),
    isAdminInternoServer(supabase, userId),
  ]);
  const planoBruto = resolvePlanId(sub?.plano_config_id ?? null);
  const cortesia = sub?.cortesia === true || admin;
  const planoId = efetivoPlanoId(planoBruto, cortesia);
  const plano = PLANS[planoId];
  if (!cortesia && isTrialExpired(planoBruto, sub?.trial_end ?? null)) {
    throw new Error(gateMessages.trialExpirado());
  }


  // Regras específicas do plano Gratuito: 1 Convenção + 1 Contrato,
  // contadas entre todos os condomínios do usuário (owner_id).
  const planoV2Id: PlanoIdV2 = (planoId as string) in PLANOS ? (planoId as PlanoIdV2) : "gratuito";
  const planoV2 = PLANOS[planoV2Id];
  if (!cortesia && planoV2Id === "gratuito") {
    const tipoNormalizado = tipo ?? null;
    if (tipoNormalizado && !["convencao", "contrato"].includes(tipoNormalizado)) {
      throw new Error(gateMessages.uploadGratuitoBloqueado());
    }
    const countOwnerTipo = async (t: "convencao" | "contrato") => {
      const { count } = await supabase
        .from("documentos")
        .select("id, condominios!inner(owner_id)", { count: "exact", head: true })
        .eq("condominios.owner_id", userId)
        .eq("tipo", t);
      return count ?? 0;
    };
    if (tipoNormalizado === "convencao") {
      if ((await countOwnerTipo("convencao")) >= 1) {
        throw new Error(gateMessages.uploadGratuitoConvencao());
      }
    } else if (tipoNormalizado === "contrato") {
      if ((await countOwnerTipo("contrato")) >= 1) {
        throw new Error(gateMessages.uploadGratuitoContrato());
      }
    } else {
      // sem tipo (fluxo de getUploadUrl): permite se houver ao menos um dos slots livres
      const [cCv, cCt] = await Promise.all([countOwnerTipo("convencao"), countOwnerTipo("contrato")]);
      if (cCv >= 1 && cCt >= 1) {
        throw new Error(gateMessages.uploadGratuitoBloqueado());
      }
    }
    return;
  }

  // Planos pagos: se "documentosIlimitados" for true, nada a impor.
  if (planoV2.limites.documentosIlimitados) return;

  // Compat: fallback à regra antiga (não deveria ser alcançada com planos atuais).
  if (!plano.recursos.uploadDocumentos) {
    throw new Error(gateMessages.uploadDesabilitado(plano.nome));
  }
  const atual = docsRes.count ?? 0;
  if (plano.documentosMax !== null && atual >= plano.documentosMax) {
    throw new Error(gateMessages.documentosMax(plano.nome, plano.documentosMax));
  }
}

const BUCKET = "documentos";

export const listDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ condominioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("documentos")
      .select("id, nome_arquivo, titulo, tipo, status_processamento, storage_path, created_at")
      .eq("condominio_id", data.condominioId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const tipoEnum = z.enum([
  "convencao",
  "regimento",
  "ata",
  "contrato",
  "laudo_tecnico",
  "previsao_orcamentaria",
  "prestacao_contas",
  "comunicado",
  "outro",
]);

export const createDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        nomeArquivo: z.string().min(1).max(255),
        titulo: z.string().trim().min(1).max(120).optional().nullable(),
        tipo: tipoEnum,
        storagePath: z.string().min(1),
        /** Documentos gerados pelo próprio Augusto não precisam de indexação. */
        indexar: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertUploadPermitido(context.supabase, context.userId, data.condominioId, data.tipo);
    const { data: row, error } = await context.supabase
      .from("documentos")
      .insert({
        condominio_id: data.condominioId,
        nome_arquivo: data.nomeArquivo,
        titulo: data.titulo ?? null,
        tipo: data.tipo,
        storage_path: data.storagePath,
        status_processamento: data.indexar === false ? "pronto" : "processando",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error: errGet } = await context.supabase
      .from("documentos")
      .select("id, storage_path, condominio_id")
      .eq("id", data.id)
      .maybeSingle();
    if (errGet) throw new Error(errGet.message);
    if (!doc) throw new Error("Documento não encontrado");

    await context.supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error: errDel } = await context.supabase.from("documentos").delete().eq("id", doc.id);
    if (errDel) throw new Error(errDel.message);
    return { ok: true };
  });

export const processDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: doc, error: errGet } = await context.supabase
      .from("documentos")
      .select("id, condominio_id, storage_path, nome_arquivo, tipo")
      .eq("id", data.id)
      .maybeSingle();
    if (errGet) throw new Error(errGet.message);
    if (!doc) throw new Error("Documento não encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedChunksParallel } = await import("./ai-gateway.server");
    const { extractText, chunkText } = await import("./documentos.server");
    const { humanizeIngestError } = await import("./ingest-errors");

    try {
      const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
      if (dlErr || !file) {
        const { IngestError } = await import("./ingest-errors");
        throw new IngestError("upload", "Falha ao baixar o arquivo do storage", "Reenvie o documento.", dlErr?.message ?? "");
      }
      const buffer = new Uint8Array(await file.arrayBuffer());

      if (buffer.byteLength === 0) {
        const { IngestError } = await import("./ingest-errors");
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
        if (msg === "__NEEDS_VISION__") {
          usedVision = true;
          const { extractTextWithVisionDetalhado } = await import("./documentos.server");
          const r = await extractTextWithVisionDetalhado(apiKey, buffer, doc.nome_arquivo);
          text = r.texto;
          paginasFalhas = r.paginasFalhas;
          totalPaginas = r.totalPaginas;
        } else {
          throw err;
        }
      }
      if (!text.trim()) {
        const { IngestError } = await import("./ingest-errors");
        throw new IngestError(
          "ocr",
          "Não foi possível ler o conteúdo do documento",
          "Verifique se a imagem está legível e tente novamente.",
        );
      }

      const chunks = chunkText(text);


      // Embeddings em paralelo controlado (evita timeout do Worker em docs longos)
      const { embeddings, totalTokens: embTokens } = await embedChunksParallel(
        apiKey,
        chunks,
        5,
      );
      try {
        const { registrarEventoIa } = await import("./uso-ia.server");
        const { EMBEDDING_MODEL } = await import("./ai-gateway.server");
        await registrarEventoIa({
          userId: context.userId,
          condominioId: doc.condominio_id,
          origem: "embedding_documento",
          model: EMBEDDING_MODEL,
          tokensInput: embTokens,
          meta: { documento_id: doc.id, chunks: chunks.length, arquivo: doc.nome_arquivo },
        });
        if (usedVision) {
          await registrarEventoIa({
            userId: context.userId,
            condominioId: doc.condominio_id,
            origem: "ocr_visao_documento",
            model: "google/gemini-3-flash-preview",
            tokensOutput: Math.ceil(text.length / 4),
            meta: { documento_id: doc.id, arquivo: doc.nome_arquivo },
          });
        }
      } catch (err) {
        console.error("[uso-ia] processDocumento:", err);
      }
      const rows = chunks.map((c, i) => ({
        condominio_id: doc.condominio_id,
        documento_id: doc.id,
        conteudo: c,
        embedding: `[${embeddings[i].join(",")}]`,
      }));

      // insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        const { error: insErr } = await supabaseAdmin.from("document_chunks").insert(slice);
        if (insErr) {
          const { IngestError } = await import("./ingest-errors");
          throw new IngestError("indexacao", "Falha ao salvar os trechos indexados", "Tente reprocessar o documento.", insErr.message);
        }
      }

      await supabaseAdmin
        .from("documentos")
        .update({ status_processamento: "pronto" })
        .eq("id", doc.id);

      // Auto-extração de unidades quando o documento é a convenção.
      // Best-effort: se falhar, não invalida o processamento do documento.
      if (doc.tipo === "convencao") {
        try {
          const { _extrairESalvarSugestaoUnidades } = await import("./unidades-ia.functions");
          await _extrairESalvarSugestaoUnidades(context.supabase, doc.id, apiKey);
        } catch (autoErr) {
          console.warn("[processDocumento] auto-extração de unidades falhou", autoErr);
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
  });

export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        condominioId: z.string().uuid(),
        nomeArquivo: z.string().min(1).max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertUploadPermitido(context.supabase, context.userId, data.condominioId);
    const safeName = data.nomeArquivo.replace(/[^\w.\-]+/g, "_");
    const path = `${data.condominioId}/${Date.now()}_${safeName}`;
    const { data: signed, error } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const getDocumentoViewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documentos")
      .select("id, storage_path, nome_arquivo")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Confirma que o arquivo existe no storage antes de assinar a URL.
    const barra = doc.storage_path.lastIndexOf("/");
    const pasta = barra >= 0 ? doc.storage_path.slice(0, barra) : "";
    const arquivo = barra >= 0 ? doc.storage_path.slice(barra + 1) : doc.storage_path;
    const { data: encontrados } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(pasta, { search: arquivo, limit: 100 });
    if (!encontrados?.some((f) => f.name === arquivo)) {
      throw new Error(
        "O arquivo não está mais disponível no armazenamento. O upload pode ter falhado — exclua este registro e envie o documento novamente.",
      );
    }
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 3600);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Falha ao gerar link do documento");
    return { url: signed.signedUrl, nome: doc.nome_arquivo };
  });
