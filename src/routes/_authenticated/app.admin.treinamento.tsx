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
  X as XIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  getKbFileUrl,
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
  storage_path?: string | null;
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
  const fetchFileUrl = useServerFn(getKbFileUrl);

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

  const handleOpen = async (d: KbDoc) => {
    // Abre janela imediatamente para não ser bloqueado por pop-up blocker.
    const win = window.open("about:blank", "_blank");
    try {
      const { url } = (await fetchFileUrl({ data: { id: d.id } })) as { url: string };
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo");
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
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Novos documentos — arquivos</DialogTitle>
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
          <Card className="divide-y divide-[var(--landing-rule)]">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-4">
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  {d.storage_path || d.url ? (
                    <button
                      type="button"
                      onClick={() => handleOpen(d)}
                      className="text-sm font-medium truncate text-primary text-left hover:underline w-full"
                      title="Abrir arquivo em nova aba"
                    >
                      {d.titulo}
                    </button>
                  ) : (
                    <p
                      className="text-sm font-medium truncate text-primary"
                      title="Item criado por texto colado (sem arquivo)"
                    >
                      {d.titulo}
                    </p>
                  )}
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
  type TipoKb = CreateInput["tipo"];
  type LinhaKb = {
    uid: string;
    file: File;
    tipo: TipoKb;
    titulo: string;
    fonte: string;
    status: "pendente" | "enviando" | "pronto" | "erro";
    erro?: string;
  };

  const MAX_FILES = 10;
  const MAX_MB = 20;
  const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";

  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [linhas, setLinhas] = useState<LinhaKb[]>([]);
  const [uploading, setUploading] = useState(false);

  const tituloDeNome = (nome: string) =>
    nome.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

  const sugerirTipo = (nome: string): TipoKb => {
    const l = nome.toLowerCase();
    if (/juris|ac[oó]rd[aã]o|stj|stf|tj/.test(l)) return "jurisprudencia";
    if (/doutrina|artigo|autor/.test(l)) return "doutrina";
    if (/\blei\b|c[oó]digo|norma|decreto|nbr/.test(l)) return "lei";
    if (/pe[cç]a|peti[cç][aã]o|contesta|recurso/.test(l)) return "peca";
    if (/orienta|guia|manual/.test(l)) return "orientacao";
    return "outro";
  };

  const adicionarArquivos = (arquivos: FileList | File[]) => {
    const lista = Array.from(arquivos);
    const livres = MAX_FILES - linhas.length;
    if (livres <= 0) {
      toast.error(`Máximo de ${MAX_FILES} arquivos por vez.`);
      return;
    }
    const aceitos: LinhaKb[] = [];
    for (const file of lista.slice(0, livres)) {
      if (file.size === 0) {
        toast.error(`"${file.name}" está vazio.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${file.name}" excede ${MAX_MB} MB.`);
        continue;
      }
      if (!new RegExp(`(${ACCEPT.replace(/\./g, "\\.").replace(/,/g, "|")})$`, "i").test(file.name)) {
        toast.error(`Formato não suportado: ${file.name}`);
        continue;
      }
      aceitos.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        tipo: sugerirTipo(file.name),
        titulo: tituloDeNome(file.name),
        fonte: "",
        status: "pendente",
      });
    }
    if (aceitos.length) setLinhas((prev) => [...prev, ...aceitos]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removerLinha = (uid: string) =>
    setLinhas((prev) => prev.filter((l) => l.uid !== uid));
  const atualizarLinha = (uid: string, patch: Partial<LinhaKb>) =>
    setLinhas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const enviarTodos = async () => {
    const pendentes = linhas.filter((l) => l.status === "pendente");
    if (!pendentes.length) return;
    setUploading(true);
    let sucesso = 0;
    for (const linha of pendentes) {
      atualizarLinha(linha.uid, { status: "enviando" });
      try {
        const { path, token } = await getUrl({ data: { nomeArquivo: linha.file.name } });
        const { error: upErr } = await supabase.storage
          .from("kb-documentos")
          .uploadToSignedUrl(path, token, linha.file);
        if (upErr) throw new Error(upErr.message);
        const created = await createDoc({
          data: {
            titulo: linha.titulo.trim() || tituloDeNome(linha.file.name),
            tipo: linha.tipo,
            fonte: linha.fonte.trim() || null,
            storagePath: path,
          },
        });
        atualizarLinha(linha.uid, { status: "pronto" });
        processDoc({ data: { id: created.id } }).catch((e) =>
          toast.error(`${linha.file.name}: ${e instanceof Error ? e.message : "falha ao processar"}`),
        );
        sucesso += 1;
      } catch (e) {
        atualizarLinha(linha.uid, {
          status: "erro",
          erro: e instanceof Error ? e.message : "Falha no upload",
        });
      }
    }
    setUploading(false);
    if (sucesso > 0) {
      toast.success(`${sucesso} arquivo(s) enviado(s). Indexação em andamento.`);
      onDone();
    }
    // manter apenas erros visíveis
    setLinhas((prev) => prev.filter((l) => l.status === "erro"));
  };

  const totalMb = (linhas.reduce((s, l) => s + l.file.size, 0) / (1024 * 1024)).toFixed(2);

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-border"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounter.current += 1;
          setDragOver(true);
        }}
        onDragLeave={() => {
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dragCounter.current = 0;
          setDragOver(false);
          if (e.dataTransfer.files.length) adicionarArquivos(e.dataTransfer.files);
        }}
      >
        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Arraste arquivos aqui ou
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files?.length && adicionarArquivos(e.target.files)}
        />
        <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()}>
          Selecionar arquivos
        </Button>
        <p className="text-[11px] text-muted-foreground mt-2">
          PDF, DOCX, TXT ou imagens (JPG/PNG/WEBP). Até {MAX_FILES} arquivos, máx. {MAX_MB} MB
          cada. PDFs escaneados são lidos por OCR.
        </p>
      </div>

      {linhas.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Arquivo</TableHead>
                <TableHead className="w-[18%]">Tipo</TableHead>
                <TableHead className="w-[24%]">Título</TableHead>
                <TableHead className="w-[18%]">Fonte</TableHead>
                <TableHead className="w-[8%]">Status</TableHead>
                <TableHead className="w-[4%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.uid}>
                  <TableCell className="text-sm font-medium">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate" title={l.file.name}>
                        {l.file.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.tipo}
                      onValueChange={(v) => atualizarLinha(l.uid, { tipo: v as TipoKb })}
                      disabled={uploading || l.status !== "pendente"}
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={l.titulo}
                      onChange={(e) => atualizarLinha(l.uid, { titulo: e.target.value })}
                      disabled={uploading || l.status !== "pendente"}
                      maxLength={200}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs"
                      value={l.fonte}
                      onChange={(e) => atualizarLinha(l.uid, { fonte: e.target.value })}
                      disabled={uploading || l.status !== "pendente"}
                      placeholder="STJ, autor…"
                    />
                  </TableCell>
                  <TableCell>
                    {l.status === "pendente" && (
                      <span className="text-xs text-muted-foreground">Pendente</span>
                    )}
                    {l.status === "enviando" && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Enviando
                      </span>
                    )}
                    {l.status === "pronto" && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent">
                        <CheckCircle2 className="h-3 w-3" /> Enviado
                      </span>
                    )}
                    {l.status === "erro" && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-destructive"
                        title={l.erro}
                      >
                        <AlertTriangle className="h-3 w-3" /> Erro
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={uploading}
                      onClick={() => removerLinha(l.uid)}
                      title="Remover da lista"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {linhas.length} arquivo(s) selecionado(s) · {totalMb} MB
            </span>
            <Button type="button" onClick={enviarTodos} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" /> Enviar e indexar todos
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}