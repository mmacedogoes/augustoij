import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

const BUCKET = "kb-documentos";
const kbTipo = z.enum(["jurisprudencia", "doutrina", "lei", "peca", "orientacao", "outro"]);

export const listKbDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("kb_documentos")
      .select("id, titulo, tipo, fonte, url, storage_path, status_processamento, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Gera uma URL assinada (curta duração) para visualizar o arquivo
 * original de um item da Base de Conhecimento em uma nova aba.
 */
export const getKbFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: doc, error } = await context.supabase
      .from("kb_documentos")
      .select("id, url, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado");
    if (doc.url) return { url: doc.url, kind: "external" as const };
    if (!doc.storage_path) throw new Error("Este item não possui arquivo (somente texto).");
    const { data: signed, error: sErr } = await context.supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Falha ao gerar URL");
    return { url: signed.signedUrl, kind: "signed" as const };
  });

export const getKbUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ nomeArquivo: z.string().min(1).max(255) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const safe = data.nomeArquivo.replace(/[^\w.\-]+/g, "_");
    const path = `${Date.now()}_${safe}`;
    const { data: signed, error } = await context.supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const createKbDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      titulo: z.string().min(2).max(240),
      tipo: kbTipo,
      fonte: z.string().max(240).optional().nullable(),
      url: z.string().url().max(500).optional().nullable(),
      storagePath: z.string().optional().nullable(),
      conteudoBruto: z
        .string()
        .max(
          150000,
          "Texto muito grande para processamento síncrono. Para documentos acima de 150.000 caracteres, faça upload do arquivo PDF/DOCX em vez de colar texto.",
        )
        .optional()
        .nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (!data.storagePath && !data.conteudoBruto) {
      throw new Error("Informe um arquivo ou um texto bruto.");
    }
    const { data: row, error } = await context.supabase
      .from("kb_documentos")
      .insert({
        titulo: data.titulo,
        tipo: data.tipo,
        fonte: data.fonte ?? null,
        url: data.url ?? null,
        storage_path: data.storagePath ?? null,
        conteudo_bruto: data.conteudoBruto ?? null,
        status_processamento: "processando",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "kb.create",
      target_kb_id: row.id,
      metadata: { titulo: data.titulo, tipo: data.tipo },
    });

    return row;
  });

export const deleteKbDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: doc } = await context.supabase
      .from("kb_documentos")
      .select("id, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");
    if (doc.storage_path) {
      await context.supabase.storage.from(BUCKET).remove([doc.storage_path]);
    }
    const { error } = await context.supabase.from("kb_documentos").delete().eq("id", doc.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "kb.delete",
      target_kb_id: doc.id,
      metadata: {},
    });
    return { ok: true };
  });

export const processKbDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { data: doc, error } = await context.supabase
      .from("kb_documentos")
      .select("id, titulo, storage_path, conteudo_bruto")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedChunksParallel } = await import("./ai-gateway.server");
    const { extractText, extractTextWithVision, chunkText } = await import("./documentos.server");
    const { humanizeIngestError, IngestError } = await import("./ingest-errors");

    // Nome original (após o prefixo `<timestamp>_`) para diagnóstico e detecção
    // de extensão. storage_path permanece como identificador interno.
    const fileName = doc.storage_path
      ? doc.storage_path.replace(/^\d+_/, "")
      : doc.titulo;

    try {
      let texto = doc.conteudo_bruto ?? "";
      if (!texto && doc.storage_path) {
        const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
        if (dlErr || !file) {
          throw new IngestError("upload", "Falha ao baixar o arquivo do storage", "Reenvie o documento.", dlErr?.message ?? "");
        }
        const buffer = new Uint8Array(await file.arrayBuffer());
        if (buffer.byteLength === 0) {
          throw new IngestError(
            "upload",
            "Arquivo armazenado está vazio (0 bytes)",
            "O upload falhou ou o arquivo original está vazio. Reenvie o documento.",
          );
        }
        try {
          texto = await extractText(buffer, fileName);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Mesmo fallback dos fluxos de Condomínio e Chat:
          // PDF escaneado ou imagem -> OCR/visão automático.
          if (msg === "__NEEDS_VISION__") {
            texto = await extractTextWithVision(apiKey, buffer, fileName);
          } else {
            throw err;
          }
        }
      }
      if (!texto.trim()) {
        throw new IngestError(
          "ocr",
          "Não foi possível ler o conteúdo do documento",
          "Verifique se a imagem está legível e tente novamente.",
        );
      }

      // Limpa chunks antigos
      await supabaseAdmin.from("kb_chunks").delete().eq("kb_documento_id", doc.id);

      const chunks = chunkText(texto, 1000, 150);
      // Paralelismo controlado: evita timeout do Worker em documentos longos.
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
          origem: "embedding_kb",
          model: EMBEDDING_MODEL,
          tokensInput: embTokens,
          meta: { kb_documento_id: doc.id, chunks: chunks.length, titulo: doc.titulo },
        });
      } catch (err) {
        console.error("[uso-ia] processKbDocumento:", err);
      }
      const rows = chunks.map((c, i) => ({
        kb_documento_id: doc.id,
        conteudo: c,
        embedding: `[${embeddings[i].join(",")}]`,
      }));
      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        const { error: insErr } = await supabaseAdmin.from("kb_chunks").insert(slice);
        if (insErr) {
          throw new IngestError("indexacao", "Falha ao salvar os trechos indexados", "Tente reprocessar o documento.", insErr.message);
        }
      }

      await supabaseAdmin
        .from("kb_documentos")
        .update({ status_processamento: "pronto" })
        .eq("id", doc.id);

      return { ok: true, chunks: chunks.length };
    } catch (e) {
      const ing = humanizeIngestError(e, "leitura");
      await supabaseAdmin
        .from("kb_documentos")
        .update({ status_processamento: ing.toStatus() })
        .eq("id", doc.id);
      throw new Error(ing.toHuman());
    }
  });

/* ===================== ORIENTAÇÕES ===================== */

export const listOrientacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("ai_orientacoes")
      .select("id, titulo, conteudo, ativo, ordem, updated_at")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertOrientacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      titulo: z.string().min(2).max(250),
      conteudo: z
        .string()
        .min(5, "Conteúdo muito curto. Use ao menos 5 caracteres.")
        .max(
          100000,
          "Conteúdo muito grande. O limite é de 100.000 caracteres (≈ 20.000 palavras). Divida em múltiplas orientações.",
        ),
      ativo: z.boolean().default(true),
      ordem: z.number().int().min(0).default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("ai_orientacoes")
        .update({
          titulo: data.titulo,
          conteudo: data.conteudo,
          ativo: data.ativo,
          ordem: data.ordem,
          updated_by: context.userId,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await context.supabase.from("admin_audit_log").insert({
        actor_user_id: context.userId,
        action: "orientacao.update",
        metadata: { id: data.id, titulo: data.titulo },
      });
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("ai_orientacoes")
      .insert({
        titulo: data.titulo,
        conteudo: data.conteudo,
        ativo: data.ativo,
        ordem: data.ordem,
        updated_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "orientacao.create",
      metadata: { id: row.id, titulo: data.titulo },
    });
    return row;
  });

export const deleteOrientacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("ai_orientacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("admin_audit_log").insert({
      actor_user_id: context.userId,
      action: "orientacao.delete",
      metadata: { id: data.id },
    });
    return { ok: true };
  });