import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminListPosts,
  adminListCategorias,
  adminCreateCategoria,
  adminUpsertPost,
  adminGetPost,
  adminDeletePost,
} from "@/lib/blog.functions";

export const Route = createFileRoute("/_authenticated/app/admin/blog")({
  component: AdminBlogPage,
  validateSearch: (s: Record<string, unknown>) => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),
});

type Categoria = { id: string; nome: string; slug: string };
type PostRow = Awaited<ReturnType<typeof adminListPosts>>[number];

function AdminBlogPage() {
  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Blog</h1>
        <p className="text-muted-foreground">Publique artigos para a comunidade.</p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Tabs defaultValue="posts" className="mt-2">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="novo">Novo / Editar</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-4">
            <PostsList />
          </TabsContent>
          <TabsContent value="novo" className="mt-4">
            <PostEditor />
          </TabsContent>
          <TabsContent value="categorias" className="mt-4">
            <CategoriasTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function PostsList() {
  const list = useServerFn(adminListPosts);
  const remove = useServerFn(adminDeletePost);
  const [rows, setRows] = useState<PostRow[]>([]);
  const refresh = useCallback(() => {
    list({ data: undefined as never })
      .then((x) => setRows(x as PostRow[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [list]);
  useEffect(refresh, [refresh]);

  return (
    <Card className="divide-y">
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhum post cadastrado.</p>
      ) : (
        rows.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium text-primary">{p.titulo}</p>
              <p className="text-xs text-muted-foreground">
                /{p.slug} · {p.status}
                {p.publicado_em ? ` · ${new Date(p.publicado_em).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            {p.status === "publicado" && (
              <Link to="/blog/$slug" params={{ slug: p.slug }} target="_blank">
                <Button size="sm" variant="ghost">Ver</Button>
              </Link>
            )}
            <Link to="/app/admin/blog" search={{ edit: p.id }}>
              <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm("Excluir este post?")) return;
                try {
                  await remove({ data: { id: p.id } });
                  refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha");
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}

function PostEditor() {
  const upsert = useServerFn(adminUpsertPost);
  const listCats = useServerFn(adminListCategorias);
  const getOne = useServerFn(adminGetPost);
  const search = Route.useSearch() as { edit?: string };
  const [cats, setCats] = useState<Categoria[]>([]);
  const [form, setForm] = useState({
    id: undefined as string | undefined,
    titulo: "",
    resumo: "",
    conteudo_markdown: "",
    imagem_capa: "",
    categoria_id: "",
    status: "rascunho" as "rascunho" | "publicado" | "agendado",
  });

  useEffect(() => {
    listCats({ data: undefined as never })
      .then((c) => setCats(c as Categoria[]))
      .catch(() => undefined);
  }, [listCats]);

  useEffect(() => {
    if (search.edit) {
      getOne({ data: { id: search.edit } })
        .then((p) => {
          if (p)
            setForm({
              id: p.id,
              titulo: p.titulo ?? "",
              resumo: p.resumo ?? "",
              conteudo_markdown: p.conteudo_markdown ?? "",
              imagem_capa: p.imagem_capa ?? "",
              categoria_id: p.categoria_id ?? "",
              status: (p.status as typeof form.status) ?? "rascunho",
            });
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.edit]);

  const save = async (status: typeof form.status) => {
    if (!form.titulo || !form.conteudo_markdown) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    try {
      await upsert({
        data: {
          id: form.id,
          titulo: form.titulo,
          resumo: form.resumo || undefined,
          conteudo_markdown: form.conteudo_markdown,
          imagem_capa: form.imagem_capa || null,
          categoria_id: form.categoria_id || null,
          status,
        },
      });
      toast.success(status === "publicado" ? "Post publicado!" : "Rascunho salvo");
      setForm({ id: undefined, titulo: "", resumo: "", conteudo_markdown: "", imagem_capa: "", categoria_id: "", status: "rascunho" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <Label>Título</Label>
        <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
      </div>
      <div>
        <Label>Resumo</Label>
        <Input value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} maxLength={500} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Imagem de capa (URL)</Label>
          <Input value={form.imagem_capa} onChange={(e) => setForm({ ...form, imagem_capa: e.target.value })} />
        </div>
        <div>
          <Label>Categoria</Label>
          <Select value={form.categoria_id || "none"} onValueChange={(v) => setForm({ ...form, categoria_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Conteúdo (Markdown)</Label>
        <Textarea
          rows={16}
          value={form.conteudo_markdown}
          onChange={(e) => setForm({ ...form, conteudo_markdown: e.target.value })}
          className="font-mono text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => save("rascunho")}>Salvar rascunho</Button>
        <Button onClick={() => save("publicado")}>Publicar</Button>
      </div>
    </Card>
  );
}

function CategoriasTab() {
  const list = useServerFn(adminListCategorias);
  const create = useServerFn(adminCreateCategoria);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const refresh = useCallback(() => {
    list({ data: undefined as never })
      .then((x) => setCats(x as Categoria[]))
      .catch(() => undefined);
  }, [list]);
  useEffect(refresh, [refresh]);
  return (
    <Card className="p-5 space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          try {
            await create({ data: { nome: nome.trim() } });
            setNome("");
            refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha");
          }
        }}
        className="flex gap-2"
      >
        <Input placeholder="Nova categoria" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </form>
      <ul className="divide-y rounded-md border">
        {cats.map((c) => (
          <li key={c.id} className="p-3 text-sm flex justify-between">
            <span className="text-primary font-medium">{c.nome}</span>
            <span className="text-xs text-muted-foreground">/{c.slug}</span>
          </li>
        ))}
        {cats.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhuma categoria.</li>}
      </ul>
    </Card>
  );
}