import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, FileType2, Loader2, Save } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseDocumento, validarConteudo } from "@/lib/documento-export";
import { SalvarNoCondominioDialog } from "@/components/chat/SalvarNoCondominioDialog";

type Formato = "pdf" | "docx";

/** Pré-visualização com a mesma formatação usada na geração do arquivo. */
function Previa({ conteudo, titulo }: { conteudo: string; titulo: string }) {
  const { titulo: tit, blocos } = useMemo(
    () => parseDocumento(conteudo, titulo),
    [conteudo, titulo],
  );

  if (!conteudo.trim()) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Escreva o texto à esquerda para ver aqui como o documento vai ficar.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-6" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
      <p className="text-center text-[15px] font-bold uppercase leading-relaxed">{tit}</p>
      <div className="mt-4 space-y-2">
        {blocos.map((b, i) => {
          if (b.tipo === "subtitulo")
            return (
              <p key={i} className="pt-2 text-[14px] font-bold uppercase">
                {b.texto}
              </p>
            );
          if (b.tipo === "item")
            return (
              <p key={i} className="pl-6 text-[14px] leading-[1.6]">
                •&nbsp;&nbsp;{b.texto}
              </p>
            );
          if (b.tipo === "centro")
            return (
              <p key={i} className="pt-4 text-center text-[14px]">
                {b.texto}
              </p>
            );
          return (
            <p key={i} className="text-justify text-[14px] leading-[1.6]" style={{ textIndent: "2cm" }}>
              {b.texto}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function EditorMinuta({
  open,
  onOpenChange,
  conteudoInicial,
  tituloInicial,
  condominioId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conteudoInicial: string;
  tituloInicial: string;
  condominioId?: string;
}) {
  const [texto, setTexto] = useState(conteudoInicial);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [salvarAberto, setSalvarAberto] = useState(false);

  useEffect(() => {
    if (open) {
      setTexto(conteudoInicial);
      setTitulo(tituloInicial);
    }
  }, [open, conteudoInicial, tituloInicial]);

  const alterado = texto !== conteudoInicial || titulo !== tituloInicial;
  const tituloLimpo = titulo.trim();
  const erroTitulo =
    tituloLimpo.length === 0
      ? "Informe o título do documento."
      : tituloLimpo.length > 120
        ? "O título é longo demais (máx. 120 caracteres)."
        : null;
  const erroConteudo = validarConteudo(texto);
  const bloqueado = Boolean(erroTitulo || erroConteudo) || gerando !== null;

  function fechar(v: boolean) {
    if (gerando) return;
    if (!v && alterado && !window.confirm("Descartar as alterações feitas no documento?")) return;
    onOpenChange(v);
  }

  async function gerar(formato: Formato) {
    if (gerando) return;
    const problema = erroConteudo ?? erroTitulo;
    if (problema) {
      toast.error(problema);
      return;
    }
    setGerando(formato);
    try {
      const mod = await import("@/lib/documento-export");
      if (formato === "pdf") await mod.gerarPdf(texto, tituloLimpo);
      else await mod.gerarDocx(texto, tituloLimpo);
      toast.success(`Arquivo ${formato.toUpperCase()} gerado e baixado.`);
    } catch (e) {
      console.error("[documento-export] falha no editor", formato, e);
      toast.error(`Não foi possível gerar o ${formato.toUpperCase()}. Tente novamente.`);
    } finally {
      setGerando(null);
    }
  }

  const editor = (
    <Textarea
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      spellCheck
      className="h-full min-h-[320px] resize-none font-mono text-xs leading-relaxed"
      placeholder="Texto do documento…"
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={fechar}>
        <DialogContent className="max-w-5xl h-[88vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>
              Ajuste o texto à esquerda; a prévia à direita mostra a formatação final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="minuta-titulo">Título</Label>
            <Input
              id="minuta-titulo"
              value={titulo}
              maxLength={120}
              disabled={gerando !== null}
              onChange={(e) => setTitulo(e.target.value)}
            />
            {erroTitulo && <p className="text-xs text-destructive">{erroTitulo}</p>}
          </div>

          {/* Desktop: tela dividida. Mobile: abas. */}
          <div className="hidden min-h-0 flex-1 gap-3 md:flex">
            <div className="min-w-0 flex-1">{editor}</div>
            <div className="min-w-0 flex-1 overflow-hidden rounded-md border">
              <Previa conteudo={texto} titulo={tituloLimpo} />
            </div>
          </div>
          <Tabs defaultValue="editar" className="flex min-h-0 flex-1 flex-col md:hidden">
            <TabsList className="self-start">
              <TabsTrigger value="editar">Editar</TabsTrigger>
              <TabsTrigger value="previa">Visualizar</TabsTrigger>
            </TabsList>
            <TabsContent value="editar" className="min-h-0 flex-1">
              {editor}
            </TabsContent>
            <TabsContent value="previa" className="min-h-0 flex-1 overflow-hidden rounded-md border">
              <Previa conteudo={texto} titulo={tituloLimpo} />
            </TabsContent>
          </Tabs>

          {erroConteudo && <p className="text-xs text-destructive">{erroConteudo}</p>}

          <DialogFooter className="flex-wrap gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {texto.trim().length.toLocaleString("pt-BR")} caracteres
            </span>
            <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => gerar("pdf")}>
              {gerando === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Gerar PDF
            </Button>
            <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => gerar("docx")}>
              {gerando === "docx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileType2 className="h-4 w-4" />
              )}
              Gerar DOCX
            </Button>
            {condominioId && (
              <Button size="sm" disabled={bloqueado} onClick={() => setSalvarAberto(true)}>
                <Save className="h-4 w-4" />
                Salvar no condomínio
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalvarNoCondominioDialog
        open={salvarAberto}
        onOpenChange={setSalvarAberto}
        conteudo={texto}
        titulo={tituloLimpo}
        condominioId={condominioId}
      />
    </>
  );
}