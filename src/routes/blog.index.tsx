import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listPostsPublicos, listCategoriasPublicas } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog do CondoIA — gestão condominial inteligente" },
      { name: "description", content: "Artigos sobre gestão de condomínios, jurisprudência e direito condominial." },
    ],
  }),
  component: BlogIndex,
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
    categoria: typeof s.categoria === "string" ? s.categoria : undefined,
  }),
});

type Post = Awaited<ReturnType<typeof listPostsPublicos>>[number];
type Cat = Awaited<ReturnType<typeof listCategoriasPublicas>>[number];

function BlogIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const listPosts = useServerFn(listPostsPublicos);
  const listCats = useServerFn(listCategoriasPublicas);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => {
    listPosts({ data: { q: search.q, categoria: search.categoria } })
      .then((x) => setPosts(x as Post[]))
      .catch(() => undefined);
  }, [listPosts, search.q, search.categoria]);
  useEffect(() => {
    listCats({ data: undefined as never })
      .then((x) => setCats(x as Cat[]))
      .catch(() => undefined);
  }, [listCats]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <Link to="/" className="flex items-center"><Logo size="md" /></Link>
          <nav className="flex items-center gap-6">
            <Link to="/blog" className="text-sm font-medium text-primary">Blog</Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">Entrar</Link>
            <Link to="/signup"><Button>Começar grátis</Button></Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl font-bold text-primary tracking-tight">Blog do CondoIA</h1>
        <p className="mt-2 text-muted-foreground">Conhecimento prático sobre gestão condominial.</p>

        <form
          className="mt-6 flex flex-col sm:flex-row gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: q || undefined, categoria: search.categoria } });
          }}
        >
          <Input placeholder="Buscar artigos…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit">Buscar</Button>
        </form>

        {cats.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/blog"
              search={{ q: search.q, categoria: undefined }}
              className={`text-xs px-3 py-1 rounded-full border ${!search.categoria ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-primary"}`}
            >
              Todas
            </Link>
            {cats.map((c) => (
              <Link
                key={c.id}
                to="/blog"
                search={{ q: search.q, categoria: c.slug }}
                className={`text-xs px-3 py-1 rounded-full border ${search.categoria === c.slug ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-primary"}`}
              >
                {c.nome}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full">Nenhum artigo publicado ainda.</p>
          ) : (
            posts.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }}>
                <Card className="overflow-hidden h-full hover:border-primary/40 transition-colors">
                  {p.imagem_capa ? (
                    <img src={p.imagem_capa} alt={p.titulo} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-44 w-full bg-card" />
                  )}
                  <div className="p-5">
                    {p.categoria && (
                      <span className="text-[11px] uppercase tracking-wide text-primary">{p.categoria.nome}</span>
                    )}
                    <h3 className="mt-2 font-semibold text-primary leading-snug">{p.titulo}</h3>
                    {p.resumo && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.resumo}</p>}
                    {p.publicado_em && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {new Date(p.publicado_em).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>

      <footer className="border-t border-border py-8 bg-background mt-12">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo variant="icon" size="sm" />
            <span>© {new Date().getFullYear()} CondoIA</span>
          </div>
          <Link to="/" className="hover:text-primary">Voltar ao site</Link>
        </div>
      </footer>
    </div>
  );
}