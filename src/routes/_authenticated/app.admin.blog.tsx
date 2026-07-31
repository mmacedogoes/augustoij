import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Upload, Loader2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  adminListPosts,
  adminListCategorias,
  adminCreateCategoria,
  adminUpsertPost,
  adminGetPost,
  adminDeletePost,
  adminUploadCapaBlog,
} from "@/lib/blog.functions";

export const Route = createFileRoute("/_authenticated/app/admin/blog")({
  component: AdminBlogPage,
  validateSearch: (s: Record<string, unknown>) => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
    novo: s.novo === true || s.novo === "1" ? true : undefined,
  }),
});

type Categoria = { id: string; nome: string; slug: string };
type PostRow = Awaited<ReturnType<typeof adminListPosts>>[number];
type CapaLayout = "padrao" | "hero" | "lateral";

type FormState = {
  id: string | undefined;
  titulo: string;
  resumo: string;
  conteudo_markdown: string;
  imagem_capa: string;
  capa_layout: CapaLayout;
  categoria_id: string;
  status: "rascunho" | "publicado" | "agendado";
  meta_description: string;
  palavras_chave: string;
};

const EMPTY_FORM: FormState = {
  id: undefined,
  titulo: "",
  resumo: "",
  conteudo_markdown: "",
  imagem_capa: "",
  capa_layout: "padrao",
  categoria_id: "",
  status: "rascunho",
  meta_description: "",
  palavras_chave: "",
};

function AdminBlogPage() {
  const search = Route.useSearch() as { edit?: string; novo?: boolean };
  const navigate = useNavigate();
  const closeDialog = useCallback(
    () => navigate({ to: "/app/admin/blog", search: {} }),
    [navigate],
  );
  const openNovo = useCallback(
    () => navigate({ to: "/app/admin/blog", search: { novo: true } }),
    [navigate],
  );
  const editorOpen = Boolean(search.edit) || Boolean(search.novo);
  const [refreshKey, setRefreshKey] = useState(0);

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
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="posts" className="mt-4">
            <div className="mb-3 flex justify-end">
              <Button onClick={openNovo}>
                <Plus className="mr-1 h-4 w-4" /> Novo post
              </Button>
            </div>
            <PostsList refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="categorias" className="mt-4">
            <CategoriasTab />
          </TabsContent>
        </Tabs>

        <PostEditorDialog
          open={editorOpen}
          editId={search.edit}
          onClose={closeDialog}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
            closeDialog();
          }}
        />
      </div>
    </AppShell>
  );
}

function PostsList({ refreshKey }: { refreshKey: number }) {
  const list = useServerFn(adminListPosts);
  const remove = useServerFn(adminDeletePost);
  const [rows, setRows] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setLoading(true);
    setErr(null);
    list({ data: undefined as never })
      .then((x) => setRows(x as PostRow[]))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Falha ao carregar posts";
        setErr(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [list]);
  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return (
    <Card className="app-card divide-y divide-[var(--landing-rule)]">
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : err ? (
        <div className="p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-red-500">{err}</p>
          <Button size="sm" variant="outline" onClick={refresh}>Tentar de novo</Button>
        </div>
      ) : rows.length === 0 ? (
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
                  toast.success("Post excluído");
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

function PostEditorDialog({
  open,
  editId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const upsert = useServerFn(adminUpsertPost);
  const listCats = useServerFn(adminListCategorias);
  const getOne = useServerFn(adminGetPost);
  const uploadCapa = useServerFn(adminUploadCapaBlog);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ao abrir: resetar e carregar dados (categorias sempre; post se estiver editando)
  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setLoadErr(null);
    listCats({ data: undefined as never })
      .then((c) => setCats(c as Categoria[]))
      .catch(() => undefined);
    if (!editId) return;
    setLoadingPost(true);
    getOne({ data: { id: editId } })
      .then((p) => {
        if (!p) {
          setLoadErr("Post não encontrado.");
          return;
        }
        setForm({
          id: p.id,
          titulo: p.titulo ?? "",
          resumo: p.resumo ?? "",
          conteudo_markdown: p.conteudo_markdown ?? "",
          imagem_capa: p.imagem_capa ?? "",
          capa_layout:
            ((p as { capa_layout?: CapaLayout }).capa_layout as CapaLayout) ?? "padrao",
          categoria_id: p.categoria_id ?? "",
          status: (p.status as FormState["status"]) ?? "rascunho",
          meta_description: (p as { meta_description?: string | null }).meta_description ?? "",
          palavras_chave: Array.isArray((p as { tags?: string[] }).tags)
            ? ((p as { tags?: string[] }).tags ?? []).join(", ")
            : "",
        });
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoadingPost(false));
  }, [open, editId, listCats, getOne]);

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Arquivo maior que 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        r.readAsDataURL(file);
      });
      const { url } = await uploadCapa({
        data: { filename: file.name, mime: file.type, base64 },
      });
      setForm((f) => ({ ...f, imagem_capa: url }));
      toast.success("Capa carregada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async (status: FormState["status"]) => {
    if (!form.titulo || !form.conteudo_markdown) {
      toast.error("Título e conteúdo são obrigatórios");
      return;
    }
    if (form.titulo.trim().length < 3) {
      toast.error("Título muito curto");
      return;
    }
    if (form.meta_description.length > 160) {
      toast.error("Meta descrição deve ter no máximo 160 caracteres");
      return;
    }
    const tagsPreview = form.palavras_chave
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagsPreview.length > 15) {
      toast.error("Máximo de 15 palavras-chave");
      return;
    }
    if (tagsPreview.some((t) => t.length > 40)) {
      toast.error("Cada palavra-chave deve ter no máximo 40 caracteres");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        data: {
          id: form.id,
          titulo: form.titulo,
          resumo: form.resumo || undefined,
          conteudo_markdown: form.conteudo_markdown,
          imagem_capa: form.imagem_capa || null,
          capa_layout: form.capa_layout,
          categoria_id: form.categoria_id || null,
          status,
          meta_description: form.meta_description.trim() || null,
          palavras_chave: form.palavras_chave.trim() || null,
        },
      });
      toast.success(status === "publicado" ? "Post publicado!" : "Rascunho salvo");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar post" : "Novo post"}</DialogTitle>
        </DialogHeader>

        {loadingPost ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando post…
          </div>
        ) : loadErr ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-red-500">{loadErr}</p>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={180} />
            </div>
            <div>
              <Label>Resumo</Label>
              <Input value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} maxLength={500} />
            </div>
            <div>
              <Label>Meta descrição (SEO)</Label>
              <Textarea
                rows={2}
                maxLength={160}
                value={form.meta_description}
                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                placeholder="Texto que aparece nos resultados do Google. Ideal entre 120 e 160 caracteres."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.meta_description.length}/160 · Se vazio, usa o resumo do post.
              </p>
            </div>
            <div>
              <Label>Palavras-chave (SEO)</Label>
              <Input
                value={form.palavras_chave}
                onChange={(e) => setForm({ ...form, palavras_chave: e.target.value })}
                placeholder="condomínio, síndico, LGPD"
              />
              <p className="mt-1 text-xs text-muted-foreground">Separe por vírgula. Máx. 15 palavras.</p>
            </div>

            <div>
              <Label>Imagem de capa</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                  {uploading ? "Enviando..." : "Carregar arquivo"}
                </Button>
                <Input
                  className="flex-1"
                  value={form.imagem_capa}
                  onChange={(e) => setForm({ ...form, imagem_capa: e.target.value })}
                  placeholder="ou cole uma URL da imagem"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 3 MB.</p>
              {form.imagem_capa && (
                <img
                  src={form.imagem_capa}
                  alt="Preview da capa"
                  className="mt-3 aspect-[16/9] w-full max-w-md rounded-md object-cover border"
                />
              )}
            </div>

            <div>
              <Label>Diagramação da capa</Label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(
                  [
                    { id: "padrao", nome: "Padrão", desc: "Capa acima do título" },
                    { id: "hero", nome: "Hero", desc: "Título sobre a capa" },
                    { id: "lateral", nome: "Lateral", desc: "Capa ao lado" },
                  ] as { id: CapaLayout; nome: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, capa_layout: opt.id })}
                    className={cn(
                      "rounded-md border p-3 text-left transition",
                      form.capa_layout === opt.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <LayoutPreview kind={opt.id} />
                    <p className="mt-2 text-sm font-medium">{opt.nome}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
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

            <div>
              <Label>Conteúdo (Markdown)</Label>
              <Textarea
                rows={14}
                value={form.conteudo_markdown}
                onChange={(e) => setForm({ ...form, conteudo_markdown: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="outline" disabled={saving || loadingPost || Boolean(loadErr)} onClick={() => save("rascunho")}>
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button disabled={saving || loadingPost || Boolean(loadErr)} onClick={() => save("publicado")}>
            {saving ? "Publicando..." : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LayoutPreview({ kind }: { kind: CapaLayout }) {
  if (kind === "hero") {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded bg-muted">
        <div className="absolute inset-0 bg-gradient-to-b from-muted-foreground/40 to-muted-foreground/70" />
        <div className="absolute inset-x-2 bottom-2 h-1.5 rounded bg-background/80" />
        <div className="absolute inset-x-2 bottom-4 h-2 w-2/3 rounded bg-background/90" />
      </div>
    );
  }
  if (kind === "lateral") {
    return (
      <div className="flex aspect-[16/10] w-full gap-1.5 rounded bg-muted p-1.5">
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-full rounded bg-muted-foreground/40" />
          <div className="h-1 w-5/6 rounded bg-muted-foreground/30" />
          <div className="h-1 w-4/6 rounded bg-muted-foreground/30" />
          <div className="h-1 w-5/6 rounded bg-muted-foreground/30" />
        </div>
        <div className="w-1/2 rounded bg-muted-foreground/50" />
      </div>
    );
  }
  return (
    <div className="aspect-[16/10] w-full space-y-1.5 rounded bg-muted p-1.5">
      <div className="h-1/2 rounded bg-muted-foreground/50" />
      <div className="h-1.5 w-3/4 rounded bg-muted-foreground/40" />
      <div className="h-1 w-full rounded bg-muted-foreground/30" />
    </div>
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
    <Card className="app-card p-5 space-y-4">
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
      <ul className="divide-y divide-[var(--landing-rule)] rounded-md border">
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