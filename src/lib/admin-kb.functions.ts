import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "kb-documentos";
const kbTipo = z.enum(["jurisprudencia", "doutrina", "lei", "peca", "orientacao", "outro"]);

async function ensureAdmin(context: { supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: boolean | null; error: { message: string } | null }> }; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const listKbDocumentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("kb_documentos")
      .select("id, titulo, tipo, fonte, url, status_processamento, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
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
      conteudoBruto: z.string().optional().nullable(),
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
    const { embedText } = await import("./ai-gateway.server");
    const { extractText, chunkText } = await import("./documentos.server");

    try {
      let texto = doc.conteudo_bruto ?? "";
      if (!texto && doc.storage_path) {
        const { data: file, error: dlErr } = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
        if (dlErr || !file) throw new Error(dlErr?.message || "Falha ao baixar arquivo");
        const buffer = new Uint8Array(await file.arrayBuffer());
        texto = await extractText(buffer, doc.storage_path);
      }
      if (!texto.trim()) throw new Error("Sem conteúdo para processar.");

      // Limpa chunks antigos
      await supabaseAdmin.from("kb_chunks").delete().eq("kb_documento_id", doc.id);

      const chunks = chunkText(texto, 1000, 150);
      const rows: Array<{ kb_documento_id: string; conteudo: string; embedding: string }> = [];
      for (const c of chunks) {
        const emb = await embedText(apiKey, c);
        rows.push({
          kb_documento_id: doc.id,
          conteudo: c,
          embedding: `[${emb.join(",")}]`,
        });
      }
      for (let i = 0; i < rows.length; i += 50) {
        const slice = rows.slice(i, i + 50);
        const { error: insErr } = await supabaseAdmin.from("kb_chunks").insert(slice);
        if (insErr) throw new Error(insErr.message);
      }

      await supabaseAdmin
        .from("kb_documentos")
        .update({ status_processamento: "pronto" })
        .eq("id", doc.id);

      return { ok: true, chunks: chunks.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("kb_documentos")
        .update({ status_processamento: `erro: ${msg.slice(0, 200)}` })
        .eq("id", doc.id);
      throw new Error(msg);
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
      titulo: z.string().min(2).max(180),
      conteudo: z.string().min(5).max(8000),
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