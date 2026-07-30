import { useState } from "react";
import { toast } from "sonner";
import { FileText, FileType2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { validarConteudo } from "@/lib/documento-export";

type Formato = "pdf" | "docx";

export function DocumentoDownload({
  conteudo,
  titulo,
}: {
  conteudo: string;
  titulo: string;
}) {
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [dispensado, setDispensado] = useState(false);
  const [gerado, setGerado] = useState<Formato | null>(null);

  if (dispensado) return null;

  async function gerar(formato: Formato) {
    if (gerando) return; // evita clique duplo
    const erro = validarConteudo(conteudo);
    if (erro) {
      toast.error(erro);
      return;
    }
    setGerando(formato);
    try {
      const mod = await import("@/lib/documento-export");
      if (formato === "pdf") await mod.gerarPdf(conteudo, titulo);
      else await mod.gerarDocx(conteudo, titulo);
      setGerado(formato);
      toast.success(`Arquivo ${formato.toUpperCase()} gerado e baixado.`);
    } catch (e) {
      console.error("[documento-export] falha ao gerar", formato, e);
      toast.error(
        `Não foi possível gerar o ${formato.toUpperCase()}. Tente novamente em instantes.`,
      );
    } finally {
      setGerando(null);
    }
  }

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Deseja que eu gere o arquivo deste documento?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={gerando !== null} onClick={() => gerar("pdf")}>
          {gerando === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Gerar PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={gerando !== null}
          onClick={() => gerar("docx")}
        >
          {gerando === "docx" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileType2 className="h-4 w-4" />
          )}
          Gerar DOCX
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={gerando !== null}
          onClick={() => setDispensado(true)}
        >
          Não, obrigado
        </Button>
      </div>
      {gerado && (
        <p className="mt-2 text-xs text-muted-foreground">
          Arquivo {gerado.toUpperCase()} baixado. Você pode gerar o outro formato se quiser.
        </p>
      )}
    </div>
  );
}