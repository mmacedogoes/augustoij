import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listKbDocumentos,
  getKbUploadUrl,
  createKbDocumento,
  processKbDocumento,
  deleteKbDocumento,
} from "@/lib/admin-kb.functions";

export const Route = createFileRoute("/_authenticated/app/admin/treinamento")({
  component: Page,
});

type KbDoc = {
  id: string;
  titulo: string;
  tipo: string;
  fonte: string | null;
  url: string | null;
  status_processamento: string;
  created_at: string;
};

const TIPOS = [
  { v: "jurisprudencia", l: "Jurisprudência" },
  { v: "doutrina", l: "Doutrina" },
  { v: "lei", l: "Lei / Norma" },
  { v: "peca", l: "Peça jurídica" },
  { v: "orientacao", l: "Orientação" },
  { v: "outro", l: "Outro" },
] as const;

function Page() {
  const fetchDocs = useServerFn(listKbDocumentos);
  const getUrl = useServerFn(getKbUploadUrl);
  const createDoc = useServerFn(createKbDocumento);
  const processDoc = useServerFn(processKbDocumento);
  const removeDoc = useServerFn(deleteKbDocumento);

  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [openText, setOpenText] = useState(false);
  const [openFile, setOpenFile] = useState(false);

  const refresh = useCallback(
    () =>
      fetchDocs()
        .then((r) => setDocs(r as KbDoc[]))
        .catch(() => {}),
    [fetchDocs],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const pending = docs.some((d) => d.status_processamento === "processando");
    if (!pending) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este item da base de conhecimento?")) return;
    try {
      await removeDoc({ data: { id } });
      toast.success("Item removido");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const statusBadge = (s: string) => {
    if (s === "pronto")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-accent">
          <CheckCircle2 className="h-3 w-3" /> Pronto
        </span>
      );
    if (s === "processando")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Processando
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title={s}>
        <AlertTriangle className="h-3 w-3" /> Erro
      </span>
    );
  };

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Treinar a IA</h1>
        <p className="text-muted-foreground">
          Alimente o assistente com jurisprudências, artigos, peças e legislação. O conteúdo é
          indexado por embeddings e usado em todas as respostas.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Dialog open={openFile} onOpenChange={setOpenFile}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-1" /> Enviar arquivo (PDF/DOCX/TXT)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo documento — arquivo</DialogTitle>
              </DialogHeader>
              <FileForm
                onDone={() => {
                  setOpenFile(false);
                  refresh();
                }}
                getUrl={getUrl}
                createDoc={createDoc}
                processDoc={processDoc}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={openText} onOpenChange={setOpenText}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Adicionar texto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo documento — texto</DialogTitle>
              </DialogHeader>
              <TextForm
                onDone={() => {
                  setOpenText(false);
                  refresh();
                }}
                createDoc={createDoc}
                processDoc={processDoc}
              />
            </DialogContent>
          </Dialog>
        </div>

        {docs.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum conteúdo na base ainda. Comece adicionando uma jurisprudência ou um artigo.
            </p>
          </Card>
        ) : (
          <Card className="divide-y">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-primary">{d.titulo}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground capitalize">{d.tipo}</span>
                    {d.fonte && (
                      <span className="text-xs text-muted-foreground">Fonte: {d.fonte}</span>
                    )}
                    {statusBadge(d.status_processamento)}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(d.id)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

type CreateInput = {
  titulo: string;
  tipo: "jurisprudencia" | "doutrina" | "lei" | "peca" | "orientacao" | "outro";
  fonte?: string | null;
  url?: string | null;
  storagePath?: string | null;
  conteudoBruto?: string | null;
};

function TextForm({
  onDone,
  createDoc,
  processDoc,
}: {
  onDone: () => void;
  createDoc: (a: { data: CreateInput }) => Promise<{ id: string }>;
  processDoc: (a: { data: { id: string } }) => Promise<unknown>;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<CreateInput["tipo"]>("jurisprudencia");
  const [fonte, setFonte] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titulo.trim().length < 2 || conteudo.trim().length < 5) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    setSaving(true);
    try {
      const created = await createDoc({
        data: { titulo, tipo, fonte: fonte || null, conteudoBruto: conteudo },
      });
      toast.success("Indexando…");
      processDoc({ data: { id: created.id } })
        .then(() => toast.success("Conteúdo pronto para uso"))
        .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao processar"));
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as CreateInput["tipo"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.v} value={t.v}>
                  {t.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fonte (opcional)</Label>
          <Input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="STJ, autor, lei..." />
        </div>
      </div>
      <div>
        <Label>Conteúdo</Label>
        <Textarea
          rows={10}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Cole aqui a ementa, artigo, doutrina ou orientação..."
          required
        />
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Salvar e indexar
      </Button>
    </form>
  );
}

function FileForm({
  onDone,
  getUrl,
  createDoc,
  processDoc,
}: {
  onDone: () => void;
  getUrl: (a: { data: { nomeArquivo: string } }) => Promise<{ path: string; token: string }>;
  createDoc: (a: { data: CreateInput }) => Promise<{ id: string }>;
  processDoc: (a: { data: { id: string } }) => Promise<unknown>;
}) {
  const [tipo, setTipo] = useState<CreateInput["tipo"]>("jurisprudencia");
  const [fonte, setFonte] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);

  const tituloDeNome = (nome: string) =>
    nome.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").trim().slice(0, 200);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lista = Array.from(fileRef.current?.files ?? []);
    if (lista.length === 0) {
      toast.error("Selecione ao menos um arquivo");
      return;
    }
    if (lista.length > 10) {
      toast.error("Envie no máximo 10 arquivos por vez");
      return;
    }
    for (const f of lista) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`"${f.name}" excede 20 MB`);
        return;
      }
      if (f.size === 0) {
        toast.error(`"${f.name}" está vazio`);
        return;
      }
    }
    setUploading(true);
    setProgresso({ feito: 0, total: lista.length });
    let sucesso = 0;
    for (const file of lista) {
      try {
        const { path, token } = await getUrl({ data: { nomeArquivo: file.name } });
        const { error: upErr } = await supabase.storage
          .from("kb-documentos")
          .uploadToSignedUrl(path, token, file);
        if (upErr) throw new Error(upErr.message);
        const created = await createDoc({
          data: {
            titulo: tituloDeNome(file.name),
            tipo,
            fonte: fonte || null,
            storagePath: path,
          },
        });
        processDoc({ data: { id: created.id } }).catch((e) =>
          toast.error(
            `${file.name}: ${e instanceof Error ? e.message : "falha ao processar"}`,
          ),
        );
        sucesso += 1;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "falha"}`);
      }
      setProgresso((p) => (p ? { ...p, feito: p.feito + 1 } : p));
    }
    setUploading(false);
    setProgresso(null);
    if (sucesso > 0) {
      toast.success(
        `${sucesso} arquivo(s) enviado(s). Processamento em andamento.`,
      );
      onDone();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as CreateInput["tipo"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.v} value={t.v}>
                  {t.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fonte (opcional)</Label>
          <Input value={fonte} onChange={(e) => setFonte(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Arquivos (PDF, DOCX, TXT, imagem JPG/PNG/WEBP — até 20 MB cada, máx. 10)</Label>
        <Input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          O título de cada item será gerado a partir do nome do arquivo. PDFs escaneados e
          imagens são lidos por OCR/visão.
        </p>
      </div>
      {progresso && (
        <p className="text-xs text-muted-foreground">
          Enviando {progresso.feito}/{progresso.total}…
        </p>
      )}
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
        Enviar e indexar todos
      </Button>
    </form>
  );
}