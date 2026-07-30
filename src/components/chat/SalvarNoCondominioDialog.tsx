import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createDocumento, getUploadUrl } from "@/lib/documentos.functions";
import { nomeArquivo, validarConteudo } from "@/lib/documento-export";

type Formato = "pdf" | "docx";

const TIPOS = [
  { v: "comunicado", l: "Comunicado" },
  { v: "ata", l: "Ata" },
  { v: "contrato", l: "Contrato" },
  { v: "convencao", l: "Convenção" },
  { v: "regimento", l: "Regimento interno" },
  { v: "laudo_tecnico", l: "Laudo técnico" },
  { v: "previsao_orcamentaria", l: "Previsão orçamentária" },
  { v: "prestacao_contas", l: "Prestação de contas" },
  { v: "outro", l: "Outro" },
] as const;

type TipoDoc = (typeof TIPOS)[number]["v"];

export function SalvarNoCondominioDialog({
  open,
  onOpenChange,
  conteudo,
  titulo,
  condominioId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conteudo: string;
  titulo: string;
  condominioId?: string;
}) {
  const getUrl = useServerFn(getUploadUrl);
  const createDoc = useServerFn(createDocumento);

  const nomeSugerido = useMemo(() => nomeArquivo(titulo, "pdf").replace(/\.pdf$/, ""), [titulo]);
  const [nome, setNome] = useState(nomeSugerido);
  const [tipo, setTipo] = useState<TipoDoc>("comunicado");
  const [formato, setFormato] = useState<Formato>("pdf");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNome(nomeSugerido);
      setErro(null);
    }
  }, [open, nomeSugerido]);

  const nomeLimpo = nome.trim();
  const nomeInvalido =
    nomeLimpo.length === 0
      ? "Informe um nome para o arquivo."
      : nomeLimpo.length > 120
        ? "O nome do arquivo é longo demais (máx. 120 caracteres)."
        : null;

  async function salvar() {
    if (salvando) return;
    setErro(null);
    const problema = validarConteudo(conteudo) ?? nomeInvalido;
    if (problema) {
      setErro(problema);
      toast.error(problema);
      return;
    }
    if (!condominioId) {
      const msg = "Selecione um condomínio antes de salvar o documento.";
      setErro(msg);
      toast.error(msg);
      return;
    }
    setSalvando(true);
    try {
      const mod = await import("@/lib/documento-export");
      const { blob } =
        formato === "pdf"
          ? await mod.gerarPdfBlob(conteudo, titulo)
          : await mod.gerarDocxBlob(conteudo, titulo);

      const arquivo = `${nomeLimpo.replace(/\.(pdf|docx)$/i, "")}.${formato}`;
      const { path, token } = (await getUrl({
        data: { condominioId, nomeArquivo: arquivo },
      })) as { path: string; token: string };

      const file = new File([blob], arquivo, {
        type:
          formato === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const { error: upErr } = await supabase.storage
        .from("documentos")
        .uploadToSignedUrl(path, token, file);
      if (upErr) throw new Error(upErr.message);

      await createDoc({
        data: {
          condominioId,
          nomeArquivo: arquivo,
          titulo: titulo.slice(0, 120),
          tipo,
          storagePath: path,
          indexar: false,
        },
      });
      toast.success("Documento salvo no repositório do condomínio.");
      onOpenChange(false);
    } catch (e) {
      console.error("[documento] falha ao salvar no condomínio", e);
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível salvar o documento. Verifique sua conexão e tente novamente.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (salvando ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar no condomínio</DialogTitle>
          <DialogDescription>
            O arquivo é gerado no seu navegador e guardado junto com os documentos do condomínio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-nome">Nome do arquivo</Label>
            <Input
              id="doc-nome"
              value={nome}
              maxLength={120}
              disabled={salvando}
              onChange={(e) => setNome(e.target.value)}
            />
            {nomeInvalido && <p className="text-xs text-destructive">{nomeInvalido}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select
                value={formato}
                disabled={salvando}
                onValueChange={(v) => setFormato(v as Formato)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="docx">DOCX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} disabled={salvando} onValueChange={(v) => setTipo(v as TipoDoc)}>
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
          </div>

          {erro && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={salvando} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || Boolean(nomeInvalido)}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}