import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getPostPublico } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    try {
      const post = await getPostPublico({ data: { slug: params.slug } });
      return { post };
    } catch {
      return { post: null };
    }
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post ?? null;
    const url = `https://augustoij.com.br/blog/${params.slug}`;
    const title = post?.titulo ? `${post.titulo} — Blog do Augusto.IJ` : "Artigo — Blog do Augusto.IJ";
    const description = post?.resumo ?? "Artigo do Blog do Augusto.IJ sobre gestão condominial.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
    ];
    if (post?.imagem_capa) {
      meta.push({ property: "og:image", content: post.imagem_capa });
      meta.push({ name: "twitter:image", content: post.imagem_capa });
    }
    const scripts = post
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.titulo,
              datePublished: post.publicado_em ?? undefined,
              author: post.autor ? { "@type": "Person", name: post.autor } : undefined,
              image: post.imagem_capa ?? undefined,
              mainEntityOfPage: url,
            }),
          },
        ]
      : undefined;
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  component: BlogPostPage,
});

type Post = Awaited<ReturnType<typeof getPostPublico>>;

function BlogPostPage() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getPostPublico);
  const [post, setPost] = useState<Post | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fn({ data: { slug } })
      .then((p) => setPost(p as Post))
      .catch((e) => setErr(e instanceof Error ? e.message : "Falha"));
  }, [fn, slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link to="/" className="flex items-center"><Logo size="md" /></Link>
          <nav className="flex items-center gap-6">
            <Link to="/blog" className="text-sm font-medium text-primary">Blog</Link>
            <Link to="/signup"><Button>Começar grátis</Button></Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12">
        {err ? (
          <div className="text-center">
            <p className="text-muted-foreground">{err}</p>
            <Link to="/blog" className="mt-4 inline-block"><Button variant="outline">Voltar ao blog</Button></Link>
          </div>
        ) : !post ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {post.categoria && (
              <span className="text-xs uppercase tracking-wide text-primary">{post.categoria.nome}</span>
            )}
            <h1 className="mt-2 text-4xl font-bold text-primary tracking-tight leading-tight">{post.titulo}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {post.autor ? `Por ${post.autor} · ` : ""}
              {post.publicado_em ? new Date(post.publicado_em).toLocaleDateString("pt-BR") : ""}
            </p>
            {post.imagem_capa && (
              <img src={post.imagem_capa} alt={post.titulo} className="mt-6 rounded-lg w-full object-cover max-h-96" />
            )}
            <div className="prose prose-invert max-w-none mt-8 text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.conteudo_markdown ?? ""}</ReactMarkdown>
            </div>
          </>
        )}
      </article>

      <footer className="border-t border-border py-8 bg-background mt-12">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="sm" />
            <span>© {new Date().getFullYear()} Augusto.IJ</span>
          </div>
          <Link to="/blog" className="hover:text-primary">Mais artigos</Link>
        </div>
      </footer>
    </div>
  );
}