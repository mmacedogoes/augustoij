import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/config/plans";
import { resolvePlanId, isTrialExpired, gateMessages, efetivoPlanoId } from "@/lib/plan-gates";

/**
 * Verifica se o usuário logado pode enviar mais um documento no condomínio
 * (aplicado tanto em getUploadUrl quanto em createDocumento).
 */
async function assertUploadPermitido(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  condominioId: string,
) {
  const [subRes, docsRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plano_config_id, trial_end, cortesia")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("condominio_id", condominioId),
  ]);
  const planoBruto = resolvePlanId(subRes.data?.plano_config_id ?? null);
  const cortesia = subRes.data?.cortesia === true;
  const planoId = efetivoPlanoId(planoBruto, cortesia);
  const plano = PLANS[planoId];
  if (!cortesia && isTrialExpired(planoBruto, subRes.data?.trial_end ?? null)) {
    throw new Error(gateMessages.trialExpirado());
  }
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertUploadPermitido(context.supabase, context.userId, data.condominioId);
    const { data: row, error } = await context.supabase
      .from("documentos")
      .insert({
        condominio_id: data.condominioId,
        nome_arquivo: data.nomeArquivo,
        titulo: data.titulo ?? null,
        tipo: data.tipo,
        storage_path: data.storagePath,
        status_processamento: "processando",
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
      .select("id, condominio_id, storage_path, nome_arquivo")
      .eq("id", data.id)
      .maybeSingle();
    if (errGet) throw new Error(errGet.message);
    if (!doc) throw new Error("Documento não encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedChunksParallel } = await import("./ai-gateway.server");
    const { extractText, extractTextWithVision, chunkText } = await import("./documentos.server");
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
      try {
        text = await extractText(buffer, doc.nome_arquivo);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "__NEEDS_VISION__") {
          usedVision = true;
          text = await extractTextWithVision(apiKey, buffer, doc.nome_arquivo);
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

      const chunks = chunkText(text, 1000, 150);

      // Embeddings em paralelo controlado (evita timeout do Worker em docs longos)
      const embeddings = await embedChunksParallel(apiKey, chunks, 5);
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
          const { extrairUnidadesDaConvencao } = await import("./unidades-ia.functions");
          // chamado como função server-side interna (fora de RPC) — reusa a lógica
          await (extrairUnidadesDaConvencao as unknown as {
            handler: (arg: {
              data: { documentoId: string; persistir: boolean };
              context: { supabase: typeof context.supabase; userId: string };
            }) => Promise<unknown>;
          }).handler?.({
            data: { documentoId: doc.id, persistir: true },
            context: { supabase: context.supabase, userId: context.userId },
          });
        } catch (autoErr) {
          console.warn("[processDocumento] auto-extração de unidades falhou", autoErr);
        }
      }

      return { ok: true, chunks: chunks.length, mode: usedVision ? "vision" : "text" };
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
    const { data: signed, error: sErr } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl, nome: doc.nome_arquivo };
  });