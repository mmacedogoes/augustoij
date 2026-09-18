import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download,
  Copy,
  Check,
  FileText,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Code2,
  Building2,
} from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listarDocumentosParaFixtures,
  obterTextoDocumento,
  obterExtracaoAtualFormatada,
  type DocumentoOpcaoFixture,
  type ExtracaoEsperadoFormatada,
} from "@/lib/admin-extracao-fixtures.functions";

export const Route = createFileRoute("/_authenticated/app/admin/extracao-fixtures")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Fixtures de Extração | Augusto IJ" },
      {
        name: "description",
        content: "Gerenciamento e exportação de fixtures para testes de regressão de extração.",
      },
    ],
  }),
});

function Page() {
  const listarFn = useServerFn(listarDocumentosParaFixtures);
  const textoFn = useServerFn(obterTextoDocumento);
  const extracaoFn = useServerFn(obterExtracaoAtualFormatada);

  const [documentos, setDocumentos] = useState<DocumentoOpcaoFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [docSelecionado, setDocSelecionado] = useState<DocumentoOpcaoFixture | null>(null);

  // Estados de dados do documento selecionado
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [textoDoc, setTextoDoc] = useState<string | null>(null);
  const [origemTexto, setOrigemTexto] = useState<string | null>(null);
  const [extracao, setExtracao] = useState<ExtracaoEsperadoFormatada | null>(null);
  const [copiado, setCopiado] = useState(false);

  function carregarDocumentos() {
    setLoading(true);
    listarFn()
      .then((docs) => {
        setDocumentos(docs);
        if (docs.length > 0 && !docSelecionado) {
          setDocSelecionado(docs[0]);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar documentos.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    carregarDocumentos();
  }, []);

  // Quando o documento selecionado mudar, busca texto e resultado de extração
  useEffect(() => {
    if (!docSelecionado) {
      setTextoDoc(null);
      setExtracao(null);
      return;
    }

    setCarregandoDados(true);
    setCopiado(false);

    Promise.all([
      textoFn({
        data: {
          condominioId: docSelecionado.condominioId,
          documentoId: docSelecionado.documentoId,
        },
      }).catch((e) => {
        console.warn("Falha ao obter texto:", e);
        return { texto: null, origem: null };
      }),
      extracaoFn({
        data: {
          documentoId: docSelecionado.documentoId,
        },
      }).catch((e) => {
        console.warn("Falha ao obter extração:", e);
        return null;
      }),
    ])
      .then(([resTexto, resExtracao]) => {
        setTextoDoc(resTexto.texto);
        setOrigemTexto(resTexto.origem);
        setExtracao(resExtracao);
      })
      .finally(() => {
        setCarregandoDados(false);
      });
  }, [docSelecionado]);

  const documentosFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.condominioNome.toLowerCase().includes(q) ||
        d.nomeArquivo.toLowerCase().includes(q) ||
        d.documentoId.toLowerCase().includes(q),
    );
  }, [documentos, filtro]);

  const jsonFormatado = useMemo(() => {
    if (!extracao) return "";
    return JSON.stringify(extracao, null, 2);
  }, [extracao]);

  function baixarTxt() {
    if (!textoDoc || !docSelecionado) {
      toast.error("Nenhum texto disponível para download.");
      return;
    }

    const slug = (docSelecionado.condominioNome || "documento")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const blob = new Blob([textoDoc], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug || "documento"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Arquivo .txt baixado com sucesso!");
  }

  function copiarJson() {
    if (!jsonFormatado) {
      toast.error("Nenhum JSON para copiar.");
      return;
    }
    navigator.clipboard.writeText(jsonFormatado);
    setCopiado(true);
    toast.success("JSON copiado para a área de transferência!");
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminNav />

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" /> Infraestrutura de Fixtures de Extração
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exporte o texto integral e a extração atual formatada para criar arquivos de teste em{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">src/lib/extracao/fixtures/</code>.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={carregarDocumentos} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Coluna 1: Lista e Seleção de Documentos */}
        <Card className="md:col-span-1 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Documentos Processados</span>
              <Badge variant="secondary">{documentosFiltrados.length}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Escolha um documento para inspecionar e exportar.
            </CardDescription>

            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar condomínio ou arquivo..."
                className="pl-8 h-9 text-xs"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          </CardHeader>

          <CardContent className="p-2 max-h-[560px] overflow-y-auto space-y-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Carregando documentos...
              </div>
            ) : documentosFiltrados.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum documento encontrado.
              </div>
            ) : (
              documentosFiltrados.map((doc) => {
                const ativo = docSelecionado?.documentoId === doc.documentoId;
                return (
                  <button
                    key={doc.documentoId}
                    onClick={() => setDocSelecionado(doc)}
                    className={`w-full text-left p-2.5 rounded-md transition-colors text-xs border ${
                      ativo
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate font-medium">{doc.condominioNome}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground truncate">
                      <FileText className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{doc.nomeArquivo}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                      <span>Status: {doc.statusProcessamento ?? "pronto"}</span>
                      <span>{new Date(doc.criadoEm).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Coluna 2 e 3: Visualizador e Ações */}
        <div className="md:col-span-2 space-y-6">
          {docSelecionado ? (
            <>
              {/* Card de Informações e Ações do Documento */}
              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{docSelecionado.condominioNome}</span>
                        <Badge variant="outline" className="text-xs">
                          {docSelecionado.tipoDocumento || "Convenção"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Arquivo: {docSelecionado.nomeArquivo} (ID:{" "}
                        <span className="font-mono">{docSelecionado.documentoId}</span>)
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={carregandoDados || !textoDoc}
                        onClick={baixarTxt}
                      >
                        <Download className="h-4 w-4 mr-1.5" /> Baixar .txt
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={carregandoDados || !extracao || extracao.total === 0}
                        onClick={copiarJson}
                      >
                        {copiado ? (
                          <>
                            <Check className="h-4 w-4 mr-1.5 text-green-600" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1.5" /> Copiar JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-xs border-t border-muted">
                    <div>
                      <span className="text-muted-foreground block">Origem do Texto:</span>
                      <span className="font-medium capitalize">
                        {carregandoDados ? "Carregando..." : origemTexto || "Não localizado"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Tamanho Texto:</span>
                      <span className="font-medium">
                        {textoDoc ? `${(textoDoc.length / 1024).toFixed(1)} KB` : "0 KB"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Total Unidades:</span>
                      <span className="font-medium">
                        {carregandoDados ? "..." : extracao?.total ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Com Fração e Área:</span>
                      <span className="font-medium">
                        {carregandoDados
                          ? "..."
                          : extracao?.unidades.filter(
                              (u) => u.area_privativa != null && u.fracao_ideal != null,
                            ).length ?? 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Visualização do JSON formatado */}
              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-primary" /> Extração Atual Formatada (schema de fixture)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Este conteúdo segue rigorosamente o formato esperado por{" "}
                      <code className="bg-muted px-1 py-0.5 rounded text-[11px]">&lt;slug&gt;.esperado.json</code>.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    disabled={carregandoDados || !extracao || extracao.total === 0}
                    onClick={copiarJson}
                  >
                    {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>

                <CardContent className="p-4 pt-2">
                  {carregandoDados ? (
                    <div className="h-80 flex items-center justify-center text-xs text-muted-foreground">
                      Carregando dados da extração...
                    </div>
                  ) : extracao && extracao.unidades.length > 0 ? (
                    <pre className="p-3 bg-muted/50 rounded-md border text-[11px] font-mono overflow-auto max-h-[460px] text-foreground leading-relaxed">
                      {jsonFormatado}
                    </pre>
                  ) : (
                    <div className="p-8 border border-dashed rounded-md text-center text-xs text-muted-foreground">
                      Nenhuma extração encontrada em <code className="text-xs">sugestoes_unidades</code> para este documento.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center text-muted-foreground text-sm shadow-sm">
              Selecione um documento na lista à esquerda para visualizar e exportar suas fixtures.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
