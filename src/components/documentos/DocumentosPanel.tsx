import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  X as XIcon,

} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocumentos,
  getUploadUrl,
  createDocumento,
  processDocumento,
  deleteDocumento,
  getDocumentoViewUrl,
} from "@/lib/documentos.functions";

type Doc = {
  id: string;
  nome_arquivo: string;
  titulo?: string | null;
  tipo: string;
  status_processamento: string;
  created_at: string;
};

type TipoDoc =
  | "convencao"
  | "regimento"
  | "ata"
  | "contrato"
  | "laudo_tecnico"
  | "previsao_orcamentaria"
  | "prestacao_contas"
  | "comunicado"
  | "outro";

const TIPOS: { v: TipoDoc; l: string }[] = [
  { v: "convencao", l: "Convenção" },
  { v: "regimento", l: "Regimento Interno" },
  { v: "ata", l: "Ata de Assembleia" },
  { v: "contrato", l: "Contrato" },
  { v: "laudo_tecnico", l: "Laudo Técnico" },
  { v: "previsao_orcamentaria", l: "Previsão Orçamentária" },
  { v: "prestacao_contas", l: "Prestação de Contas" },
  { v: "comunicado", l: "Comunicado Oficial" },
  { v: "outro", l: "Outro" },
];

const MAX_FILES = 10;
const MAX_MB = 15;
const ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.csv,.xlsx";

function sugerirTipo(nome: string): TipoDoc {
  const l = nome.toLowerCase();
  if (/conven[cç]a[oõ]/.test(l)) return "convencao";
  if (/regimento/.test(l)) return "regimento";
  if (/\bata\b|assembl/.test(l)) return "ata";
  if (/contrato/.test(l)) return "contrato";
  if (/laudo|avcb|inspe[cç][aã]o/.test(l)) return "laudo_tecnico";
  if (/or[cç]ament|previs[aã]o/.test(l)) return "previsao_orcamentaria";
  if (/presta[cç][aã]o|contas/.test(l)) return "prestacao_contas";
  if (/comunicado|aviso|circular/.test(l)) return "comunicado";
  return "outro";
}

function sugerirTitulo(nome: string): string {
  return nome
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

type LinhaUpload = {
  uid: string;
  file: File;
  tipo: TipoDoc;
  titulo: string;
  status: "pendente" | "enviando" | "pronto" | "erro" | "duplicado";
  erro?: string;
};

export function DocumentosPanel({
  condominioId,
  readOnly = false,
}: {
  condominioId: string;
  /** Modo visualizador (admin): bloqueia upload e exclusão. */
  readOnly?: boolean;
}) {
  const fetchDocs = useServerFn(listDocumentos);
  const getUrl = useServerFn(getUploadUrl);
  const createDoc = useServerFn(createDocumento);
  const processDoc = useServerFn(processDocumento);
  const removeDoc = useServerFn(deleteDocumento);
  const getViewUrl = useServerFn(getDocumentoViewUrl);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [linhas, setLinhas] = useState<LinhaUpload[]>([]);
  const [dupQuestion, setDupQuestion] = useState<{
    nomes: string[];
    resolve: (acao: "cancelar" | "manter") => void;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchDocs({ data: { condominioId } });
      setDocs(rows as Doc[]);
    } catch {
      /* noop */
    }
  }, [fetchDocs, condominioId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // poll while there are docs in "processando"
  useEffect(() => {
    const pending = docs.some((d) => d.status_processamento === "processando");
    if (!pending) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  const adicionarArquivos = (arquivos: FileList | File[]) => {
    const lista = Array.from(arquivos);
    const livres = MAX_FILES - linhas.length;
    if (livres <= 0) {
      toast.error(`Máximo de ${MAX_FILES} arquivos por vez.`);
      return;
    }
    const aceitos: LinhaUpload[] = [];
    for (const file of lista.slice(0, livres)) {
      if (file.size === 0) {
        toast.error(`"${file.name}" está vazio.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${file.name}" excede ${MAX_MB} MB. Comprima ou divida o arquivo.`);
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
        titulo: sugerirTitulo(file.name),
        status: "pendente",
      });
    }
    if (aceitos.length) setLinhas((prev) => [...prev, ...aceitos]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removerLinha = (uid: string) =>
    setLinhas((prev) => prev.filter((l) => l.uid !== uid));

  const atualizarLinha = (uid: string, patch: Partial<LinhaUpload>) =>
    setLinhas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const askDuplicates = (nomes: string[]) =>
    new Promise<"cancelar" | "manter">((resolve) => {
      setDupQuestion({ nomes, resolve });
    });

  const enviarTodos = async () => {
    const pendentes = linhas.filter((l) => l.status === "pendente");
    if (!pendentes.length) return;

    const nomesExistentes = new Set(docs.map((d) => d.nome_arquivo.toLowerCase()));
    const dups = pendentes.filter((l) => nomesExistentes.has(l.file.name.toLowerCase()));
    if (dups.length) {
      const acao = await askDuplicates(dups.map((d) => d.file.name));
      if (acao === "cancelar") {
        const dupUids = new Set(dups.map((d) => d.uid));
        setLinhas((prev) => prev.filter((l) => !dupUids.has(l.uid)));
        return;
      }
    }

    setEnviando(true);
    let ok = 0;
    const falhas: string[] = [];
    for (const linha of pendentes) {
      atualizarLinha(linha.uid, { status: "enviando" });
      try {
        const { path, token } = (await getUrl({
          data: { condominioId, nomeArquivo: linha.file.name },
        })) as { path: string; token: string };
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .uploadToSignedUrl(path, token, linha.file);
        if (upErr) throw new Error(upErr.message);
        const created = (await createDoc({
          data: {
            condominioId,
            nomeArquivo: linha.file.name,
            titulo: linha.titulo?.trim() || null,
            tipo: linha.tipo,
            storagePath: path,
          },
        })) as { id: string };
        atualizarLinha(linha.uid, { status: "pronto" });
        ok += 1;
        processDoc({ data: { id: created.id } }).catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no upload";
        falhas.push(`${linha.file.name}: ${msg}`);
        atualizarLinha(linha.uid, { status: "erro", erro: msg });
      }
    }
    setEnviando(false);
    if (ok > 0 && falhas.length === 0) {
      toast.success("Upload concluído. Processamento dos documentos em andamento.");
    } else if (ok > 0) {
      toast.warning(
        `${ok} arquivo(s) enviado(s), ${falhas.length} com erro.`,
        { description: falhas[0] },
      );
    } else {
      toast.error("Nenhum arquivo foi enviado.", { description: falhas[0] });
    }
    refresh();
    // limpa linhas concluídas com sucesso, mantém erros visíveis
    setLinhas((prev) => prev.filter((l) => l.status === "erro"));
  };

  const abrirArquivo = async (id: string) => {
    try {
      const r = (await getViewUrl({ data: { id } })) as { url: string };
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este documento e todos os seus trechos?")) return;
    try {
      await removeDoc({ data: { id } });
      toast.success("Documento excluído");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
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

  const totalMb = useMemo(
    () => (linhas.reduce((s, l) => s + l.file.size, 0) / (1024 * 1024)).toFixed(2),
    [linhas],
  );

  const tipoLabel = (v: string) => TIPOS.find((t) => t.v === v)?.l ?? v;

  return (
    <div className="space-y-4">
      {readOnly ? (
        <Card className="app-card p-4 text-xs text-amber-200 border-amber-500/30 bg-amber-500/5">
          Modo visualizador (admin) — upload e exclusão desabilitados.
        </Card>
      ) : (
      <Card className="app-card p-5">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-primary">Enviar documentos</p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, TXT, planilhas (CSV/XLSX) ou imagens (JPG, PNG, WEBP). Até {MAX_FILES}{" "}
              arquivos, máximo de {MAX_MB} MB por arquivo. PDFs escaneados e imagens são lidos
              automaticamente pela IA.
            </p>
          </div>
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
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files?.length && adicionarArquivos(e.target.files)}
            />
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              Selecionar arquivos
            </Button>
          </div>

          {linhas.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Arquivo</TableHead>
                    <TableHead className="w-[20%]">Tipo</TableHead>
                    <TableHead className="w-[25%]">Título</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[8%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.uid}>
                      <TableCell className="font-medium text-sm">
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
                          onValueChange={(v) =>
                            atualizarLinha(l.uid, { tipo: v as TipoDoc })
                          }
                          disabled={enviando || l.status !== "pendente"}
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
                          disabled={enviando || l.status !== "pendente"}
                          maxLength={120}
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
                            className="inline-flex items-start gap-1 text-xs text-destructive"
                            title={l.erro}
                          >
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="break-words">{l.erro || "Erro"}</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={enviando}
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
                <Button onClick={enviarTodos} disabled={enviando}>
                  {enviando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" /> Carregar todos os arquivos
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
      )}

      {docs.length === 0 ? (
        <Card className="app-card p-8 text-center border-dashed">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum documento enviado ainda.
          </p>
        </Card>
      ) : (
        <Card className="app-card divide-y divide-[var(--landing-rule)]">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {d.titulo?.trim() || d.nome_arquivo}
                </p>
                {d.titulo && (
                  <p className="text-[11px] text-muted-foreground truncate">{d.nome_arquivo}</p>
                )}
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">{tipoLabel(d.tipo)}</span>
                  {statusBadge(d.status_processamento)}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => abrirArquivo(d.id)}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={reprocessando === d.id}
                  onClick={() => handleReprocessar(d.id)}
                  title="Reler documento (OCR completo)"
                >
                  {reprocessando === d.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(d.id)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

            </div>
          ))}
        </Card>
      )}

      <AlertDialog
        open={!!dupQuestion}
        onOpenChange={(o) => {
          if (!o && dupQuestion) {
            dupQuestion.resolve("cancelar");
            setDupQuestion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivo já existente</AlertDialogTitle>
            <AlertDialogDescription>
              {dupQuestion?.nomes.length === 1 ? (
                <>
                  O arquivo <strong>{dupQuestion?.nomes[0]}</strong> já está cadastrado neste
                  condomínio.
                </>
              ) : (
                <>
                  Estes arquivos já estão cadastrados neste condomínio:{" "}
                  <strong>{dupQuestion?.nomes.join(", ")}</strong>.
                </>
              )}{" "}
              Como deseja prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                dupQuestion?.resolve("cancelar");
                setDupQuestion(null);
              }}
            >
              Cancelar duplicados
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                dupQuestion?.resolve("manter");
                setDupQuestion(null);
              }}
            >
              Manter ambos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function useHasReadyDocs(condominioId: string) {
  const fetchDocs = useServerFn(listDocumentos);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!condominioId) {
      setReady(false);
      return;
    }
    const check = () =>
      fetchDocs({ data: { condominioId } })
        .then((rows) => {
          if (cancelled) return;
          setReady((rows as Doc[]).some((d) => d.status_processamento === "pronto"));
        })
        .catch(() => {});
    check();
    const t = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fetchDocs, condominioId]);
  return ready;
}