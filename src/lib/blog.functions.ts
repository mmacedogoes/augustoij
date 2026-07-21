import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "./admin-guard";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// ====== PÚBLICO ======
export const listPostsPublicos = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({ q: z.string().trim().max(80).optional(), categoria: z.string().trim().max(80).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("blog_posts")
      .select("id, titulo, slug, resumo, imagem_capa, publicado_em, categoria_id")
      .eq("status", "publicado")
      .order("publicado_em", { ascending: false })
      .limit(50);
    if (data.q) query = query.ilike("titulo", `%${data.q}%`);
    const { data: posts, error } = await query;
    if (error) throw new Error(error.message);
    const catIds = Array.from(new Set((posts ?? []).map((p) => p.categoria_id).filter(Boolean) as string[]));
    let cats: Record<string, { nome: string; slug: string }> = {};
    if (catIds.length) {
      const { data: c } = await supabaseAdmin.from("blog_categorias").select("id, nome, slug").in("id", catIds);
      cats = Object.fromEntries((c ?? []).map((x) => [x.id, { nome: x.nome, slug: x.slug }]));
    }
    let filtered = posts ?? [];
    if (data.categoria) filtered = filtered.filter((p) => p.categoria_id && cats[p.categoria_id]?.slug === data.categoria);
    return filtered.map((p) => ({ ...p, categoria: p.categoria_id ? cats[p.categoria_id] ?? null : null }));
  });

export const getPostPublico = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, titulo, slug, resumo, conteudo_markdown, imagem_capa, capa_layout, publicado_em, categoria_id, autor_id, meta_description, tags")
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) throw new Error("Post não encontrado");
    let categoria = null;
    if (post.categoria_id) {
      const { data: c } = await supabaseAdmin.from("blog_categorias").select("nome, slug").eq("id", post.categoria_id).maybeSingle();
      categoria = c;
    }
    let autor = null;
    if (post.autor_id) {
      const { data: a } = await supabaseAdmin.from("profiles").select("nome").eq("id", post.autor_id).maybeSingle();
      autor = a?.nome ?? null;
    }
    return { ...post, categoria, autor };
  });

export const listCategoriasPublicas = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("blog_categorias").select("id, nome, slug").order("nome");
  return data ?? [];
});

// ====== ADMIN ======
export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, titulo, slug, status, publicado_em, categoria_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("blog_categorias").select("id, nome, slug").order("nome");
    return data ?? [];
  });

export const adminCreateCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ nome: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_categorias").insert({ nome: data.nome, slug: slugify(data.nome) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        titulo: z.string().trim().min(3).max(180),
        resumo: z.string().trim().max(500).optional(),
        conteudo_markdown: z.string().min(1),
        imagem_capa: z.string().url().max(500).optional().nullable(),
        categoria_id: z.string().uuid().optional().nullable(),
        status: z.enum(["rascunho", "publicado", "agendado"]).default("rascunho"),
        meta_description: z.string().trim().max(160).optional().nullable(),
        palavras_chave: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tags = (data.palavras_chave ?? "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 40);
    const tagsDedup = Array.from(new Set(tags)).slice(0, 15);
    const payload = {
      titulo: data.titulo,
      slug: slugify(data.titulo) + (data.id ? "" : "-" + Date.now().toString(36)),
      resumo: data.resumo ?? null,
      conteudo_markdown: data.conteudo_markdown,
      imagem_capa: data.imagem_capa ?? null,
      categoria_id: data.categoria_id ?? null,
      status: data.status,
      publicado_em: data.status === "publicado" ? new Date().toISOString() : null,
      autor_id: context.userId,
      meta_description: data.meta_description?.length ? data.meta_description : null,
      tags: tagsDedup,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("blog_posts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    } else {
      const { data: ins, error } = await supabaseAdmin.from("blog_posts").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: ins!.id };
    }
  });

export const adminGetPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin.from("blog_posts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return post;
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });