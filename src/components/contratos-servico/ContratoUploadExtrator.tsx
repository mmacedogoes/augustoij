import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  extrairContratoServico,
  type CamposExtraidos,
} from "@/lib/contratos-servico/extrair.functions";

type Estado = "vazio" | "loading" | "erro" | "sucesso";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp";
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

function guessMime(file: File): string {
  if (file.type && ALLOWED_MIMES.has(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return map[ext] ?? file.type ?? "";
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function contarPreenchidos(c: CamposExtraidos, tipoId: string | null): number {
  let n = tipoId ? 1 : 0;
  for (const [k, v] of Object.entries(c)) {
    if (k === "tipo_servico_slug") continue;
    if (v === null || v === undefined || v === "") continue;
    n++;
  }
  return n;
}

export function ContratoUploadExtrator({
  onExtraido,
}: {
  onExtraido: (payload: { campos: CamposExtraidos; tipoServicoId: string | null }) => void;
}) {
  const extrair = useServerFn(extrairContratoServico);
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("vazio");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [preenchidos, setPreenchidos] = useState(0);

  function reset() {
    setEstado("vazio");
    setNomeArquivo(null);
    setErro(null);
    setAvisos([]);
    setPreenchidos(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setErro(null);
    setAvisos([]);
    setNomeArquivo(file.name);

    // Validação no cliente
    if (file.size === 0) {
      setEstado("erro");
      setErro("Arquivo vazio.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setEstado("erro");
      setErro(`Arquivo grande demais (máx. ${MAX_MB} MB).`);
      return;
    }
    const mime = guessMime(file);
    if (!ALLOWED_MIMES.has(mime)) {
      setEstado("erro");
      setErro("Formato não suportado. Envie PDF, DOCX, TXT, JPG, PNG ou WEBP.");
      return;
    }

    setEstado("loading");
    try {
      const fileBase64 = await fileToBase64(file);
      const r = await extrair({ data: { fileBase64, mimeType: mime, fileName: file.name } });
      setAvisos(r.avisos ?? []);
      const n = contarPreenchidos(r.campos, r.tipo_servico_id);
      setPreenchidos(n);
      setEstado("sucesso");
      if (n === 0) {
        toast.warning("Nenhum campo pôde ser identificado — preencha manualmente.");
      } else {
        toast.success(`Contrato lido: ${n} campo(s) preenchido(s).`);
        onExtraido({ campos: r.campos, tipoServicoId: r.tipo_servico_id });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha inesperada ao ler o contrato.";
      setErro(msg);
      setEstado("erro");
      toast.error(msg);
    }
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Passo 1 — Ler contrato (opcional)
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o PDF, DOCX ou imagem do contrato. A IA lê e pré-preenche os campos abaixo — você
            revisa e confirma antes de salvar.
          </p>
        </div>
        {estado !== "vazio" && estado !== "loading" ? (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            Trocar arquivo
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {estado === "vazio" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Arraste o arquivo aqui ou
          </p>
          <Button type="button" onClick={onPick} className="mt-3">
            Carregar contrato
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            PDF, DOCX, TXT ou imagem (máx. {MAX_MB} MB)
          </p>
        </div>
      )}

      {estado === "loading" && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Lendo o contrato{nomeArquivo ? ` "${nomeArquivo}"` : ""}… Isso pode levar alguns segundos.
        </div>
      )}

      {estado === "erro" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível ler o contrato</p>
          <p className="mt-1 text-destructive/80">{erro}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={onPick}>
              Tentar novamente
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              Preencher manualmente
            </Button>
          </div>
        </div>
      )}

      {estado === "sucesso" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-primary">
            Contrato lido{nomeArquivo ? `: ${nomeArquivo}` : ""}
          </p>
          <p className="mt-1 text-muted-foreground">
            {preenchidos > 0
              ? `${preenchidos} campo(s) preenchido(s) automaticamente. Revise e ajuste abaixo antes de salvar.`
              : "Nenhum campo pôde ser identificado. Preencha os dados manualmente abaixo."}
          </p>
          {avisos.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}