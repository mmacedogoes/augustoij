import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Search, BookOpen } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Eyebrow } from "@/components/landing/Eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { listPostsPublicos, listCategoriasPublicas, getPostPublico } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog do Augusto.IJ — gestão condominial inteligente" },
      { name: "description", content: "Artigos sobre gestão de condomínios, jurisprudência e direito condominial." },
      { property: "og:title", content: "Blog do Augusto.IJ — gestão condominial inteligente" },
      { property: "og:description", content: "Artigos sobre gestão de condomínios, jurisprudência e direito condominial." },
      { property: "og:url", content: "https://augustoij.com.br/blog" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://augustoij.com.br/blog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Blog do Augusto.IJ",
          url: "https://augustoij.com.br/blog",
          description: "Artigos sobre gestão de condomínios, jurisprudência e direito condominial.",
        }),
      },
    ],
  }),
  component: BlogIndex,
  validateSearch: (s: Record<string, unknown>): { q?: string; categoria?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
});

type PostSummary = Awaited<ReturnType<typeof listPostsPublicos>>[number];
type Cat = Awaited<ReturnType<typeof listCategoriasPublicas>>[number];
type FullPost = Awaited<ReturnType<typeof getPostPublico>>;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function BlogIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const listPosts = useServerFn(listPostsPublicos);
  const listCats = useServerFn(listCategoriasPublicas);
  const fetchPost = useServerFn(getPostPublico);

  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [featured, setFeatured] = useState<FullPost | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => {
    setPosts(null);
    setErr(null);
    listPosts({ data: { q: search.q, categoria: search.categoria } })
      .then((x) => setPosts(x as PostSummary[]))
      .catch((e) => setErr(e instanceof Error ? e.message : "Não foi possível carregar os artigos."));
  }, [listPosts, search.q, search.categoria]);

  useEffect(() => {
    listCats({ data: undefined as never })
      .then((x) => setCats(x as Cat[]))
      .catch(() => undefined);
  }, [listCats]);

  const latestSlug = posts?.[0]?.slug ?? null;
  useEffect(() => {
    if (!latestSlug) {
      setFeatured(null);
      return;
    }
    setFeaturedLoading(true);
    fetchPost({ data: { slug: latestSlug } })
      .then((p) => setFeatured(p as FullPost))
      .catch(() => setFeatured(null))
      .finally(() => setFeaturedLoading(false));
  }, [fetchPost, latestSlug]);

  const archive = useMemo(() => (posts ?? []).slice(1), [posts]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-augusto-green px-6 pt-16 pb-20 text-augusto-cream sm:pt-20 sm:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "var(--landing-gradient-hero)" }}
        />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6">
          <Eyebrow className="text-augusto-gold-light">
            <BookOpen className="h-3.5 w-3.5" />
            Blog do Augusto.IJ
          </Eyebrow>
          <h1 className="font-serif text-[clamp(2.75rem,6vw,5rem)] leading-[0.95] tracking-[-0.035em] text-augusto-cream">
            Doutrina prática de <span className="text-augusto-gold-light">gestão condominial</span>.
          </h1>
          <p className="max-w-2xl text-[17px] leading-[1.7] text-augusto-cream/80">
            Ensaios, jurisprudência comentada e método — para síndicos, administradoras e advogados
            que decidem com clareza.
          </p>

          <form
            className="mt-4 flex w-full max-w-xl items-center gap-3 rounded-full border border-augusto-gold/30 bg-augusto-cream/8 p-2 backdrop-blur transition-colors focus-within:border-augusto-gold"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: { q: q || undefined, categoria: search.categoria } });
            }}
          >
            <Search className="ml-3 h-4 w-4 shrink-0 text-augusto-gold-light" aria-hidden="true" />
            <Input
              placeholder="Buscar por tema, ementa, autor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 flex-1 border-0 bg-transparent px-1 text-augusto-cream placeholder:text-augusto-cream/50 shadow-none focus-visible:ring-0"
            />
            <Button type="submit" variant="augusto-gold" size="sm" className="h-9 rounded-full px-4">
              Buscar
            </Button>
          </form>
        </div>
      </section>

      {/* Main + Sidebar */}
      <section className="landing-cream-bg">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14 lg:px-8 lg:py-20">
          <article className="min-w-0">
            {err ? (
              <EmptyState
                title="Não foi possível carregar"
                description={err}
                action={
                  <Button variant="augusto-outline" onClick={() => navigate({ search: {} })}>
                    Tentar novamente
                  </Button>
                }
              />
            ) : posts === null || featuredLoading ? (
              <FeaturedSkeleton />
            ) : !featured ? (
              <EmptyState
                title="Nenhum artigo publicado ainda"
                description="Assim que o primeiro texto for ao ar, ele aparece aqui em destaque."
              />
            ) : (
              <FeaturedArticle post={featured} />
            )}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="landing-panel rounded-2xl p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-xl tracking-[-0.01em] text-augusto-green">Arquivo</h2>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
                  {posts?.length ?? 0} texto{(posts?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 h-px w-full bg-augusto-gold/25" />

              {cats.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-slate">
                    Categorias
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CategoryChip active={!search.categoria} to={{ q: search.q, categoria: undefined }}>
                      Todas
                    </CategoryChip>
                    {cats.map((c) => (
                      <CategoryChip
                        key={c.id}
                        active={search.categoria === c.slug}
                        to={{ q: search.q, categoria: c.slug }}
                      >
                        {c.nome}
                      </CategoryChip>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-slate">
                  Publicados
                </p>
                {posts === null ? (
                  <ul className="mt-3 space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <li key={i}>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="mt-2 h-3 w-1/3" />
                      </li>
                    ))}
                  </ul>
                ) : archive.length === 0 ? (
                  <p className="mt-3 text-sm text-augusto-slate/80">
                    {featured ? "Este é o único texto publicado até agora." : "Nenhum texto por aqui ainda."}
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-augusto-gold/15">
                    {archive.map((p) => (
                      <li key={p.id}>
                        <Link
                          to="/blog/$slug"
                          params={{ slug: p.slug }}
                          className="group flex items-start gap-3 py-3 transition-colors landing-focus"
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
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t border-augusto-gold/20 bg-augusto-green py-10 text-augusto-cream/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} Augusto.IJ — Todos os direitos reservados.</p>
          <Link to="/" className="transition-colors hover:text-augusto-gold-light">
            Voltar ao site
          </Link>
        </div>
      </footer>
    </div>
  );
}

function CategoryChip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: { q: string | undefined; categoria: string | undefined };
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/blog"
      search={to}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-200 landing-focus",
        active
          ? "border-transparent bg-augusto-green text-augusto-cream shadow-[var(--landing-shadow-soft)]"
          : "border-augusto-gold/35 bg-transparent text-augusto-slate hover:border-augusto-gold hover:text-augusto-green",
      )}
    >
      {children}
    </Link>
  );
}

function FeaturedArticle({ post }: { post: NonNullable<FullPost> }) {
  return (
    <div className="min-w-0">
      <Eyebrow className="mb-4">Último publicado</Eyebrow>

      {post.categoria && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-augusto-gold">
          {post.categoria.nome}
        </span>
      )}

      <h2 className="mt-3 font-serif text-[clamp(2.25rem,4.4vw,3.75rem)] leading-[1] tracking-[-0.035em] text-augusto-green">
        {post.titulo}
      </h2>

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

      {post.imagem_capa && (
        <img
          src={post.imagem_capa}
          alt={post.titulo}
          className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover shadow-[var(--landing-shadow-card)]"
          loading="lazy"
        />
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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.conteudo_markdown ?? ""}</ReactMarkdown>
      </div>

      <div className="mt-14 flex flex-col items-start gap-4 border-t border-augusto-gold/25 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-augusto-slate">Gostou? Compartilhe com um síndico ou colega de escritório.</p>
        <Button asChild variant="augusto">
          <Link to="/blog/$slug" params={{ slug: post.slug }}>
            Abrir em página cheia
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-6 h-14 w-full" />
      <Skeleton className="mt-3 h-14 w-4/5" />
      <Skeleton className="mt-6 h-4 w-64" />
      <Skeleton className="mt-8 aspect-[16/9] w-full rounded-2xl" />
      <div className="mt-10 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="landing-panel flex flex-col items-start gap-3 rounded-2xl p-10">
      <h2 className="font-serif text-2xl text-augusto-green">{title}</h2>
      <p className="text-augusto-slate">{description}</p>
      {action}
    </div>
  );
}