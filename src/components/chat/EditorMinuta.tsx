import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  FileType2,
  Loader2,
  Save,
  Building2,
  PenTool,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  parseDocumento,
  validarConteudo,
  type DocumentoExportOptions,
} from "@/lib/documento-export";
import { SalvarNoCondominioDialog } from "@/components/chat/SalvarNoCondominioDialog";
import { getCondominio } from "@/lib/condominios.functions";

type Formato = "pdf" | "docx";

/** Pré-visualização com a mesma formatação usada na geração do arquivo. */
function Previa({
  conteudo,
  titulo,
  options,
}: {
  conteudo: string;
  titulo: string;
  options?: DocumentoExportOptions;
}) {
  const { titulo: tit, blocos } = useMemo(() => {
    const res = parseDocumento(conteudo, titulo, options);
    let subtituloIdx = 0;
    return {
      ...res,
      blocos: res.blocos.map((b) => {
        if (b.tipo === "subtitulo") {
          subtituloIdx++;
          return { ...b, texto: `${subtituloIdx}. ${b.texto.toUpperCase()}` };
        }
        return b;
      }),
    };
  }, [conteudo, titulo, options]);

  if (!conteudo.trim()) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Escreva o texto à esquerda para ver aqui como o documento vai ficar.
      </div>
    );
  }

  const cab = options?.cabecalho;
  const ass = options?.assinatura;

  return (
    <div
      className="h-full overflow-auto bg-background p-6 text-foreground"
      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
    >
      {/* Cabeçalho Timbrado na Prévia */}
      {cab?.nomeCondominio && (
        <div className="mb-6 border-b border-border pb-3 text-center">
          <p className="text-[14px] font-bold uppercase tracking-wide text-foreground">
            {cab.nomeCondominio}
          </p>
          {(cab.cnpj || cab.endereco || cab.cidadeUf) && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {[cab.cnpj ? `CNPJ: ${cab.cnpj}` : null, cab.endereco, cab.cidadeUf]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
          {cab.protocolo && (
            <p className="mt-1 text-[11px] font-semibold italic text-muted-foreground">
              Protocolo nº: {cab.protocolo}
            </p>
          )}
        </div>
      )}

      {/* Título Principal */}
      <p className="text-center text-[15px] font-bold uppercase leading-relaxed text-foreground">
        {tit}
      </p>

      {/* Blocos de Conteúdo */}
      <div className="mt-4 space-y-2">
        {blocos.map((b, i) => {
          if (b.tipo === "subtitulo")
            return (
              <p key={i} className="pt-5 pb-1 text-[13.5px] font-bold uppercase text-foreground">
                {b.texto}
              </p>
            );

          if (b.tipo === "item")
            return (
              <p key={i} className="pl-6 text-[13.5px] leading-[1.6]">
                •&nbsp;&nbsp;{b.texto}
              </p>
            );
          if (b.tipo === "centro")
            return (
              <p key={i} className="pt-4 text-center text-[13.5px]">
                {b.texto}
              </p>
            );
          return (
            <p
              key={i}
              className="text-justify text-[13.5px] leading-[1.6]"
              style={{ textIndent: "2cm" }}
            >
              {b.texto}
            </p>
          );
        })}
      </div>

      {/* Bloco de Fecho e Assinaturas na Prévia */}
      {ass && (ass.cidadeData || ass.nomeResponsavel || ass.incluirSegundaAssinatura || ass.incluirTestemunhas) && (
        <div className="mt-8 pt-4 space-y-6">
          {ass.cidadeData && (
            <p className="text-right text-[13px]">{ass.cidadeData}</p>
          )}

          {ass.incluirSegundaAssinatura ? (
            <div className="grid grid-cols-2 gap-6 pt-4 text-center">
              <div>
                <p className="text-[12px] text-muted-foreground">___________________________________</p>
                <p className="mt-1 text-[12.5px] font-bold uppercase">{ass.nomeResponsavel || "NOTIFICANTE"}</p>
                {ass.cargoResponsavel && <p className="text-[11px] text-muted-foreground">{ass.cargoResponsavel}</p>}
                {ass.documentoResponsavel && <p className="text-[10.5px] text-muted-foreground">{ass.documentoResponsavel}</p>}
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">___________________________________</p>
                <p className="mt-1 text-[12.5px] font-bold uppercase">{ass.nomeSegundaAssinatura || "NOTIFICADO(A)"}</p>
                {ass.cargoSegundaAssinatura && <p className="text-[11px] text-muted-foreground">{ass.cargoSegundaAssinatura}</p>}
                {ass.documentoSegundaAssinatura && <p className="text-[10.5px] text-muted-foreground">{ass.documentoSegundaAssinatura}</p>}
              </div>
            </div>
          ) : ass.nomeResponsavel ? (
            <div className="pt-4 text-center">
              <p className="text-[12px] text-muted-foreground">____________________________________________</p>
              <p className="mt-1 text-[13px] font-bold uppercase">{ass.nomeResponsavel}</p>
              {ass.cargoResponsavel && <p className="text-[11.5px] text-muted-foreground">{ass.cargoResponsavel}</p>}
              {ass.documentoResponsavel && <p className="text-[11px] text-muted-foreground">{ass.documentoResponsavel}</p>}
            </div>
          ) : null}

          {ass.incluirTestemunhas && (
            <div className="pt-2 text-left">
              <p className="text-[12px] font-bold uppercase text-muted-foreground">TESTEMUNHAS:</p>
              <div className="mt-3 grid grid-cols-2 gap-4 text-[11px] text-muted-foreground">
                <div className="space-y-1">
                  <p>1. _________________________________</p>
                  <p>Nome:</p>
                  <p>CPF:</p>
                </div>
                <div className="space-y-1">
                  <p>2. _________________________________</p>
                  <p>Nome:</p>
                  <p>CPF:</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rodapé institucional */}
      <div className="mt-10 border-t border-border/40 pt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{cab?.nomeCondominio || "Augusto.IJ — Inteligência Jurídica Condominial"}</span>
        <span>Página 1 de 1</span>
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
  const [abaAtiva, setAbaAtiva] = useState<"texto" | "timbre" | "assinatura">("texto");
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);

  // Estados de Personalização (Timbre e Assinatura)
  const [usarTimbre, setUsarTimbre] = useState(true);
  const [nomeCondo, setNomeCondo] = useState("");
  const [cnpjCondo, setCnpjCondo] = useState("");
  const [enderecoCondo, setEnderecoCondo] = useState("");
  const [cidadeUfCondo, setCidadeUfCondo] = useState("");
  const [protocolo, setProtocolo] = useState("");

  const [usarAssinatura, setUsarAssinatura] = useState(true);
  const [cidadeData, setCidadeData] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("Administração Condominial");
  const [cargoResponsavel, setCargoResponsavel] = useState("Síndico(a) / Administrador(a)");
  const [documentoResponsavel, setDocumentoResponsavel] = useState("");
  const [incluirSegundaAssinatura, setIncluirSegundaAssinatura] = useState(false);
  const [nomeSegundaAssinatura, setNomeSegundaAssinatura] = useState("Notificado(a) / Condômino(a)");
  const [cargoSegundaAssinatura, setCargoSegundaAssinatura] = useState("Unidade Notificada");
  const [documentoSegundaAssinatura, setDocumentoSegundaAssinatura] = useState("");
  const [incluirTestemunhas, setIncluirTestemunhas] = useState(false);

  const fetchCondo = useServerFn(getCondominio);
  const { data: condoData } = useQuery({
    queryKey: ["condominio-export", condominioId],
    queryFn: () => fetchCondo({ data: { id: condominioId! } }),
    enabled: Boolean(condominioId && open),
  });

  useEffect(() => {
    if (open) {
      setTexto(conteudoInicial);
      setTitulo(tituloInicial);

      // Data formatada padrão
      const hojeFormatado = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
      }).format(new Date());

      if (condoData) {
        setNomeCondo(condoData.nome || "");
        setCnpjCondo(condoData.cnpj || "");
        setEnderecoCondo(condoData.endereco || "");
        const cidUf = [condoData.cidade, condoData.uf].filter(Boolean).join("/");
        setCidadeUfCondo(cidUf);
        setCidadeData(cidUf ? `${cidUf}, ${hojeFormatado}.` : `${hojeFormatado}.`);
      } else {
        setCidadeData(`${hojeFormatado}.`);
      }
    }
  }, [open, conteudoInicial, tituloInicial, condoData]);

  const exportOptions: DocumentoExportOptions = useMemo(() => {
    return {
      tituloPersonalizado: titulo.trim() || undefined,
      cabecalho: usarTimbre && nomeCondo.trim()
        ? {
            nomeCondominio: nomeCondo.trim(),
            cnpj: cnpjCondo.trim() || undefined,
            endereco: enderecoCondo.trim() || undefined,
            cidadeUf: cidadeUfCondo.trim() || undefined,
            protocolo: protocolo.trim() || undefined,
          }
        : undefined,
      assinatura: usarAssinatura
        ? {
            cidadeData: cidadeData.trim() || undefined,
            nomeResponsavel: nomeResponsavel.trim() || undefined,
            cargoResponsavel: cargoResponsavel.trim() || undefined,
            documentoResponsavel: documentoResponsavel.trim() || undefined,
            incluirSegundaAssinatura,
            nomeSegundaAssinatura: incluirSegundaAssinatura ? nomeSegundaAssinatura.trim() : undefined,
            cargoSegundaAssinatura: incluirSegundaAssinatura ? cargoSegundaAssinatura.trim() : undefined,
            documentoSegundaAssinatura: incluirSegundaAssinatura ? documentoSegundaAssinatura.trim() : undefined,
            incluirTestemunhas,
          }
        : undefined,
    };
  }, [
    titulo,
    usarTimbre,
    nomeCondo,
    cnpjCondo,
    enderecoCondo,
    cidadeUfCondo,
    protocolo,
    usarAssinatura,
    cidadeData,
    nomeResponsavel,
    cargoResponsavel,
    documentoResponsavel,
    incluirSegundaAssinatura,
    nomeSegundaAssinatura,
    cargoSegundaAssinatura,
    documentoSegundaAssinatura,
    incluirTestemunhas,
  ]);

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
      if (formato === "pdf") await mod.gerarPdf(texto, tituloLimpo, exportOptions);
      else await mod.gerarDocx(texto, tituloLimpo, exportOptions);
      toast.success(`Arquivo ${formato.toUpperCase()} gerado e baixado.`);
    } catch (e) {
      console.error("[documento-export] falha no editor", formato, e);
      toast.error(`Não foi possível gerar o ${formato.toUpperCase()}. Tente novamente.`);
    } finally {
      setGerando(null);
    }
  }

  const painelOpcoes = (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3 text-xs">
      {/* Seção 1: Timbre */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Building2 className="h-3.5 w-3.5 text-augusto-gold" />
            <span>Timbre do Condomínio</span>
          </div>
          <Switch checked={usarTimbre} onCheckedChange={setUsarTimbre} />
        </div>
        {usarTimbre && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
            <div className="sm:col-span-2">
              <Label className="text-[11px]">Nome do Condomínio / Entidade</Label>
              <Input
                value={nomeCondo}
                onChange={(e) => setNomeCondo(e.target.value)}
                placeholder="Ex: CONDOMÍNIO RESIDENCIAL SOLARIS"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px]">CNPJ</Label>
              <Input
                value={cnpjCondo}
                onChange={(e) => setCnpjCondo(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px]">Protocolo (opcional)</Label>
              <Input
                value={protocolo}
                onChange={(e) => setProtocolo(e.target.value)}
                placeholder="Ex: NOT-2026/042"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px]">Endereço</Label>
              <Input
                value={enderecoCondo}
                onChange={(e) => setEnderecoCondo(e.target.value)}
                placeholder="Rua, Número, Bairro"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px]">Cidade / UF</Label>
              <Input
                value={cidadeUfCondo}
                onChange={(e) => setCidadeUfCondo(e.target.value)}
                placeholder="São Paulo/SP"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/60" />

      {/* Seção 2: Assinaturas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <PenTool className="h-3.5 w-3.5 text-augusto-gold" />
            <span>Fecho e Assinaturas</span>
          </div>
          <Switch checked={usarAssinatura} onCheckedChange={setUsarAssinatura} />
        </div>
        {usarAssinatura && (
          <div className="space-y-2.5 pt-1">
            <div>
              <Label className="text-[11px]">Local e Data</Label>
              <Input
                value={cidadeData}
                onChange={(e) => setCidadeData(e.target.value)}
                placeholder="Ex: São Paulo/SP, 10 de maio de 2026."
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[11px]">Responsável / Notificante</Label>
                <Input
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  placeholder="Nome do Síndico ou Administração"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Cargo / Qualificação</Label>
                <Input
                  value={cargoResponsavel}
                  onChange={(e) => setCargoResponsavel(e.target.value)}
                  placeholder="Ex: Síndico(a) Profissional"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">Documento (CPF / OAB / CNPJ)</Label>
              <Input
                value={documentoResponsavel}
                onChange={(e) => setDocumentoResponsavel(e.target.value)}
                placeholder="Ex: CPF nº 000.000.000-00"
                className="h-8 text-xs"
              />
            </div>

            {/* Checkbox Segunda Assinatura */}
            <div className="pt-1 flex items-center justify-between border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">
                Incluir 2ª assinatura (Notificado / Morador)
              </span>
              <Switch
                checked={incluirSegundaAssinatura}
                onCheckedChange={setIncluirSegundaAssinatura}
              />
            </div>
            {incluirSegundaAssinatura && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 bg-background/50 p-2 rounded border border-border/40">
                <div>
                  <Label className="text-[10.5px]">Nome do Notificado</Label>
                  <Input
                    value={nomeSegundaAssinatura}
                    onChange={(e) => setNomeSegundaAssinatura(e.target.value)}
                    placeholder="Nome do Condômino"
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10.5px]">Qualificação / Unidade</Label>
                  <Input
                    value={cargoSegundaAssinatura}
                    onChange={(e) => setCargoSegundaAssinatura(e.target.value)}
                    placeholder="Ex: Condômino - Unidade 101"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Checkbox Testemunhas */}
            <div className="flex items-center justify-between border-t border-border/40 pt-1">
              <span className="text-[11px] text-muted-foreground">
                Incluir campos para 2 testemunhas
              </span>
              <Switch
                checked={incluirTestemunhas}
                onCheckedChange={setIncluirTestemunhas}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const editor = (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpcoesAbertas((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-augusto-gold hover:underline"
        >
          <span>{opcoesAbertas ? "Ocultar timbre e assinaturas" : "Personalizar timbre e assinaturas"}</span>
          {opcoesAbertas ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {opcoesAbertas && painelOpcoes}

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        spellCheck
        className="h-full min-h-[260px] flex-1 resize-none font-mono text-xs leading-relaxed"
        placeholder="Texto do documento…"
      />
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={fechar}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col gap-3">
          <DialogHeader className="pb-1">
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>
              Ajuste o texto, timbre e assinaturas à esquerda; a prévia à direita mostra o resultado final em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label htmlFor="minuta-titulo" className="text-xs">Título da Peça</Label>
            <Input
              id="minuta-titulo"
              value={titulo}
              maxLength={120}
              disabled={gerando !== null}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-8 text-xs font-semibold"
            />
            {erroTitulo && <p className="text-xs text-destructive">{erroTitulo}</p>}
          </div>

          {/* Desktop: tela dividida. Mobile: abas. */}
          <div className="hidden min-h-0 flex-1 gap-3 md:flex">
            <div className="min-w-0 flex-1 overflow-y-auto pr-1">{editor}</div>
            <div className="min-w-0 flex-1 overflow-hidden rounded-md border shadow-inner">
              <Previa conteudo={texto} titulo={tituloLimpo} options={exportOptions} />
            </div>
          </div>

          <Tabs defaultValue="editar" className="flex min-h-0 flex-1 flex-col md:hidden">
            <TabsList className="self-start">
              <TabsTrigger value="editar">Texto</TabsTrigger>
              <TabsTrigger value="opcoes">Timbre & Assinatura</TabsTrigger>
              <TabsTrigger value="previa">Visualizar</TabsTrigger>
            </TabsList>
            <TabsContent value="editar" className="min-h-0 flex-1">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                spellCheck
                className="h-full min-h-[300px] resize-none font-mono text-xs leading-relaxed"
                placeholder="Texto do documento…"
              />
            </TabsContent>
            <TabsContent value="opcoes" className="min-h-0 flex-1 overflow-y-auto">
              {painelOpcoes}
            </TabsContent>
            <TabsContent value="previa" className="min-h-0 flex-1 overflow-hidden rounded-md border">
              <Previa conteudo={texto} titulo={tituloLimpo} options={exportOptions} />
            </TabsContent>
          </Tabs>

          {erroConteudo && <p className="text-xs text-destructive">{erroConteudo}</p>}

          <DialogFooter className="flex-wrap gap-2 pt-1 border-t">
            <span className="mr-auto text-xs text-muted-foreground self-center">
              {texto.trim().length.toLocaleString("pt-BR")} caracteres
            </span>
            <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => gerar("pdf")}>
              {gerando === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 text-rose-500" />
              )}
              Gerar PDF Timbrado
            </Button>
            <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => gerar("docx")}>
              {gerando === "docx" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileType2 className="h-4 w-4 text-blue-500" />
              )}
              Gerar DOCX Timbrado
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