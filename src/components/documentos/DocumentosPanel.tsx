import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocumentos,
  getUploadUrl,
  createDocumento,
  processDocumento,
  deleteDocumento,
} from "@/lib/documentos.functions";

type Doc = {
  id: string;
  nome_arquivo: string;
  tipo: string;
  status_processamento: string;
  created_at: string;
};

const TIPOS = [
  { v: "convencao", l: "Convenção" },
  { v: "regimento", l: "Regimento" },
  { v: "ata", l: "Ata" },
  { v: "contrato", l: "Contrato" },
  { v: "outro", l: "Outro" },
] as const;

export function DocumentosPanel({ condominioId }: { condominioId: string }) {
  const fetchDocs = useServerFn(listDocumentos);
  const getUrl = useServerFn(getUploadUrl);
  const createDoc = useServerFn(createDocumento);
  const processDoc = useServerFn(processDocumento);
  const removeDoc = useServerFn(deleteDocumento);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState<string>("outro");
  const inputRef = useRef<HTMLInputElement>(null);

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

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo excede 10 MB");
      return;
    }
    setUploading(true);
    try {
      const { path, token } = (await getUrl({
        data: { condominioId, nomeArquivo: file.name },
      })) as { path: string; token: string };
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(path, token, file);
      if (upErr) throw new Error(upErr.message);

      const created = (await createDoc({
        data: {
          condominioId,
          nomeArquivo: file.name,
          tipo: tipo as "convencao" | "regimento" | "ata" | "contrato" | "outro",
          storagePath: path,
        },
      })) as { id: string };

      toast.success("Arquivo enviado. Processando…");
      refresh();

      // fire-and-forget processing
      processDoc({ data: { id: created.id } })
        .then(() => {
          toast.success("Documento pronto para consultas");
          refresh();
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Falha ao processar");
          refresh();
        });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
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

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <p className="text-sm font-medium text-primary mb-2">Enviar novo documento</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX ou TXT, até 10 MB.</p>
          </div>
          <div className="w-full sm:w-44">
            <Select value={tipo} onValueChange={setTipo}>
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
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </Card>

      {docs.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum documento enviado ainda.
          </p>
        </Card>
      ) : (
        <Card className="divide-y">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.nome_arquivo}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground capitalize">{d.tipo}</span>
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
  );
}

export function useHasReadyDocs(condominioId: string) {
  const fetchDocs = useServerFn(listDocumentos);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
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