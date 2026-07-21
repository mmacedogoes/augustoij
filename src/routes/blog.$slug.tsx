import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getPostPublico, listPostsPublicos } from "@/lib/blog.functions";

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
    const description =
      post?.meta_description?.trim() ||
      post?.resumo?.slice(0, 160) ||
      "Artigo do Blog do Augusto.IJ sobre gestão condominial.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
    ];
    if (post?.tags && post.tags.length > 0) {
      meta.push({ name: "keywords", content: post.tags.join(", ") });
    }
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
    return { meta, links: [{ rel: "canonical", href: url }], scripts };
  },
  component: BlogPostPage,
});

type Post = Awaited<ReturnType<typeof getPostPublico>>;
type PostSummary = Awaited<ReturnType<typeof listPostsPublicos>>[number];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function BlogPostPage() {
  const { slug } = Route.useParams();
  const fetchPost = useServerFn(getPostPublico);
  const listPosts = useServerFn(listPostsPublicos);

  const [post, setPost] = useState<Post | null>(null);
  const [others, setOthers] = useState<PostSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    fetchPost({ data: { slug } })
      .then((p) => setPost(p as Post))
      .catch((e) => setErr(e instanceof Error ? e.message : "Artigo indisponível."))
      .finally(() => setLoading(false));
  }, [fetchPost, slug]);

  useEffect(() => {
    listPosts({ data: {} })
      .then((x) => setOthers((x as PostSummary[]).filter((p) => p.slug !== slug)))
      .catch(() => undefined);
  }, [listPosts, slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="landing-cream-bg">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14 lg:px-8 lg:pt-20 lg:pb-24">
          <article className="min-w-0">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.18em] text-augusto-gold transition-colors hover:text-augusto-green landing-focus"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao arquivo
            </Link>

            {loading ? (
              <PostSkeleton />
            ) : err || !post ? (
              <div className="landing-panel mt-8 flex flex-col items-start gap-3 rounded-2xl p-10">
                <h1 className="font-serif text-3xl text-augusto-green">Artigo não encontrado</h1>
                <p className="text-augusto-slate">{err ?? "Este artigo não está mais disponível."}</p>
                <Button asChild variant="augusto-outline">
                  <Link to="/blog">Voltar ao blog</Link>
                </Button>
              </div>
            ) : (
              <>
                <Eyebrow className="mt-6">Ensaio</Eyebrow>

                {post.categoria && (
                  <span className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                    {post.categoria.nome}
                  </span>
                )}
                <h1 className="mt-3 font-serif text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] tracking-[-0.035em] text-augusto-green">
                  {post.titulo}
                </h1>

                <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-augusto-slate">
                  {post.autor && <span className="font-medium text-augusto-green">Por {post.autor}</span>}
                  {post.autor && post.publicado_em && (
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-augusto-gold" />
                  )}
                  {post.publicado_em && (
                    <span className="uppercase tracking-[0.14em]">{formatDate(post.publicado_em)}</span>
                  )}
                </p>

                {post.resumo && (
                  <p className="mt-6 border-l-2 border-augusto-gold pl-5 font-serif text-[1.25rem] italic leading-[1.55] text-augusto-slate-dark">
                    {post.resumo}
                  </p>
                )}

                {post.imagem_capa && (post.capa_layout ?? "padrao") === "padrao" && (
                  <img
                    src={post.imagem_capa}
                    alt={post.titulo}
                    className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover shadow-[var(--landing-shadow-card)]"
                  />
                )}
                {post.imagem_capa && post.capa_layout === "hero" && (
                  <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-[var(--landing-shadow-card)]">
                    <img src={post.imagem_capa} alt={post.titulo} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-augusto-green/85 via-augusto-green/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                      <p className="font-serif text-[clamp(1.5rem,3vw,2.5rem)] leading-tight text-augusto-cream">
                        {post.titulo}
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "mt-10 max-w-none text-[17px] leading-[1.75] text-augusto-slate-dark",
                    "prose prose-neutral",
                    "prose-headings:font-serif prose-headings:tracking-[-0.02em] prose-headings:text-augusto-green",
                    "prose-h2:mt-12 prose-h2:text-[1.75rem] prose-h3:mt-10 prose-h3:text-[1.35rem]",
                    "prose-p:my-5 prose-p:text-augusto-slate-dark",
                    "prose-a:font-medium prose-a:text-augusto-green prose-a:underline prose-a:decoration-augusto-gold prose-a:underline-offset-4 hover:prose-a:text-augusto-gold",
                    "prose-strong:text-augusto-green",
                    "prose-blockquote:border-l-augusto-gold prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-augusto-slate-dark",
                    "prose-code:rounded prose-code:bg-augusto-cream-dark prose-code:px-1.5 prose-code:py-0.5 prose-code:text-augusto-green prose-code:before:content-none prose-code:after:content-none",
                    "prose-hr:border-augusto-gold/30",
                    "prose-img:rounded-xl prose-img:shadow-[var(--landing-shadow-soft)]",
                    "prose-li:marker:text-augusto-gold",
                  )}
                >
                  {post.imagem_capa && post.capa_layout === "lateral" && (
                    <img
                      src={post.imagem_capa}
                      alt={post.titulo}
                      className="mb-4 aspect-square w-full rounded-2xl object-cover shadow-[var(--landing-shadow-card)] sm:float-right sm:ml-6 sm:mb-4 sm:w-1/2 sm:max-w-[420px]"
                    />
                  )}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.conteudo_markdown ?? ""}</ReactMarkdown>
                </div>

                <div className="mt-14 border-t border-augusto-gold/25 pt-8">
                  <Button asChild variant="augusto-outline">
                    <Link to="/blog">
                      <ArrowLeft className="mr-1.5 h-4 w-4" />
                      Ver todos os artigos
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="landing-panel rounded-2xl p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl tracking-[-0.01em] text-augusto-green">Arquivo</h2>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                  {others.length} texto{others.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 h-px w-full bg-augusto-gold/25" />

              {others.length === 0 ? (
                <p className="mt-4 text-sm text-augusto-slate/80">Este é o único texto por enquanto.</p>
              ) : (
                <ul className="mt-3 divide-y divide-augusto-gold/15">
                  {others.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/blog/$slug"
                        params={{ slug: p.slug }}
                        className="group flex items-start gap-3 py-3 landing-focus"
                      >
                        <div className="min-w-0 flex-1">
                          {p.categoria && (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                              {p.categoria.nome}
                            </span>
                          )}
                          <h3 className="mt-0.5 font-serif text-[15px] leading-snug text-augusto-green transition-colors group-hover:text-augusto-gold">
                            {p.titulo}
                          </h3>
                          {p.publicado_em && (
                            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-augusto-slate/80">
                              {formatDate(p.publicado_em)}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-augusto-gold/70 transition-transform group-hover:translate-x-0.5 group-hover:text-augusto-gold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t border-augusto-gold/20 bg-augusto-green py-10 text-augusto-cream/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} Augusto.IJ — Todos os direitos reservados.</p>
          <Link to="/blog" className="transition-colors hover:text-augusto-gold-light">
            Mais artigos
          </Link>
        </div>
      </footer>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="mt-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-6 h-14 w-full" />
      <Skeleton className="mt-3 h-14 w-4/5" />
      <Skeleton className="mt-6 h-4 w-64" />
      <Skeleton className="mt-8 aspect-[16/9] w-full rounded-2xl" />
      <div className="mt-10 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
      </div>
    </div>
  );
}