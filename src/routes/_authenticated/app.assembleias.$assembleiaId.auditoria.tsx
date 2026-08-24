import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ShieldCheck, ShieldAlert, Ban, Vote, Smartphone,
  Download, FileText, Copy, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NumeralRomano } from "@/components/assembleias/NumeralRomano";
import { getAssembleia } from "@/lib/assembleias/assembleias.functions";
import {
  getResumoAuditoria, getRegistroVotos, getTentativasAuditoria, getPresencasAuditoria,
  getAtosMesa, getDispositivos, verificarIntegridadeCadeia,
  exportarVotosCsv, exportarPresencaCsv, exportarTentativasCsv, gerarDadosRelatorioAuditoria,
} from "@/lib/assembleias/auditoria.functions";
import { carimbo, truncarRecibo, agenteResumido, acaoLegivel } from "@/lib/assembleias/auditoria-utils";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/auditoria")({
  component: Page,
});

const PAGINA = 50;

function baixar(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function Indicador({
  icone: Icone, rotulo, valor, nota, alerta, children,
}: {
  icone: React.ElementType; rotulo: string; valor: React.ReactNode; nota: React.ReactNode;
  alerta?: boolean; children?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-4 border-augusto-gold/10 bg-augusto-gold/[0.02]", alerta && "border-destructive/40 bg-destructive/[0.04]")}>
      <div className="flex items-start gap-4">
        <div className={cn("h-10 w-10 rounded-lg bg-augusto-gold/10 flex items-center justify-center shrink-0", alerta && "bg-destructive/10")}>
          <Icone className={cn("h-5 w-5 text-augusto-gold", alerta && "text-destructive")} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{rotulo}</p>
          <p className={cn("text-2xl font-serif text-primary", alerta && "text-destructive")}>{valor}</p>
          <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{nota}</div>
          {children}
        </div>
      </div>
    </Card>
  );
}

function Paginado<T>({ itens, render }: { itens: T[]; render: (pagina: T[]) => React.ReactNode }) {
  const [pagina, setPagina] = useState(0);
  const total = Math.ceil(itens.length / PAGINA) || 1;
  const p = Math.min(pagina, total - 1);
  const fatia = itens.slice(p * PAGINA, p * PAGINA + PAGINA);
  return (
    <div className="space-y-3">
      {render(fatia)}
      {total > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{itens.length} registros · página {p + 1} de {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={p === 0} onClick={() => setPagina(p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={p >= total - 1} onClick={() => setPagina(p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground py-10 text-center">{texto}</p>;
}

function Page() {
  const { assembleiaId } = useParams({ from: "/_authenticated/app/assembleias/$assembleiaId/auditoria" }) as any;
  const navigate = useNavigate();

  const fnAssembleia = useServerFn(getAssembleia);
  const fnResumo = useServerFn(getResumoAuditoria);
  const fnRegistro = useServerFn(getRegistroVotos);
  const fnTentativas = useServerFn(getTentativasAuditoria);
  const fnPresencas = useServerFn(getPresencasAuditoria);
  const fnAtos = useServerFn(getAtosMesa);
  const fnDispositivos = useServerFn(getDispositivos);
  const fnVerificar = useServerFn(verificarIntegridadeCadeia);
  const fnCsvVotos = useServerFn(exportarVotosCsv);
  const fnCsvPresenca = useServerFn(exportarPresencaCsv);
  const fnCsvTentativas = useServerFn(exportarTentativasCsv);
  const fnRelatorio = useServerFn(gerarDadosRelatorioAuditoria);

  const [itemId, setItemId] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [filtroMotivo, setFiltroMotivo] = useState<string>("todos");
  const [integridade, setIntegridade] = useState<any>(null);
  const verificouRef = useRef(false);

  const assembleia = useQuery({
    queryKey: ["assembleia", assembleiaId],
    queryFn: () => fnAssembleia({ data: { id: assembleiaId } }),
  });

  const resumo = useQuery({
    queryKey: ["auditoria-resumo", assembleiaId],
    queryFn: () => fnResumo({ data: { assembleiaId } }),
  });

  const itens = useMemo(
    () => [...((assembleia.data as any)?.itens ?? [])].sort((a: any, b: any) => a.ordem - b.ordem),
    [assembleia.data],
  );

  useEffect(() => {
    if (!itemId && itens.length) setItemId(itens[0].id);
  }, [itens, itemId]);

  const verificar = useMutation({
    mutationFn: () => fnVerificar({ data: { assembleiaId } }),
    onSuccess: (r) => { setIntegridade(r); resumo.refetch(); },
    onError: () => toast.error("Não foi possível verificar a integridade da cadeia."),
  });

  useEffect(() => {
    if (verificouRef.current) return;
    verificouRef.current = true;
    verificar.mutate();
    // Uma verificação automática por sessão de navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registro = useQuery({
    queryKey: ["auditoria-votos", itemId],
    queryFn: () => fnRegistro({ data: { assembleiaId, itemId: itemId! } }),
    enabled: !!itemId,
  });

  const tentativas = useQuery({
    queryKey: ["auditoria-tentativas", assembleiaId],
    queryFn: () => fnTentativas({ data: { assembleiaId } }),
  });

  const presencas = useQuery({
    queryKey: ["auditoria-presencas", assembleiaId, sessaoId],
    queryFn: () => fnPresencas({ data: { assembleiaId, sessaoId } }),
  });

  const atos = useQuery({
    queryKey: ["auditoria-atos", assembleiaId],
    queryFn: () => fnAtos({ data: { assembleiaId } }),
  });

  const dispositivos = useQuery({
    queryKey: ["auditoria-dispositivos", assembleiaId],
    queryFn: () => fnDispositivos({ data: { assembleiaId } }),
  });

  const exportando = useMutation({
    mutationFn: async (tipo: "votos" | "presenca" | "tentativas" | "relatorio") => {
      if (tipo === "votos") {
        const r = await fnCsvVotos({ data: { assembleiaId, itemId: null } });
        baixar(r.conteudo, r.nomeArquivo, "text/csv;charset=utf-8");
        return;
      }
      if (tipo === "presenca") {
        const r = await fnCsvPresenca({ data: { assembleiaId } });
        baixar(r.conteudo, r.nomeArquivo, "text/csv;charset=utf-8");
        return;
      }
      if (tipo === "tentativas") {
        const r = await fnCsvTentativas({ data: { assembleiaId } });
        baixar(r.conteudo, r.nomeArquivo, "text/csv;charset=utf-8");
        return;
      }
      const dados = await fnRelatorio({ data: { assembleiaId } });
      const { gerarPdfAuditoria } = await import("@/lib/assembleias/auditoria-pdf");
      const blob = await gerarPdfAuditoria(dados);
      baixar(blob, `relatorio-de-auditoria-${assembleiaId.slice(0, 8)}.pdf`, "application/pdf");
    },
    onSuccess: () => toast.success("Arquivo gerado."),
    onError: () => toast.error("Falha ao gerar o arquivo."),
  });

  const itemAtual = itens.find((i: any) => i.id === itemId);
  const secreto = !!itemAtual?.secreto;

  const motivos = useMemo(
    () => [...new Set((tentativas.data ?? []).map((t: any) => t.motivo))],
    [tentativas.data],
  );
  const tentativasFiltradas = (tentativas.data ?? []).filter(
    (t: any) => filtroMotivo === "todos" || t.motivo === filtroMotivo,
  );

  if (assembleia.isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </AppShell>
    );
  }

  if (assembleia.error || !assembleia.data) {
    return (
      <AppShell>
        <div className="text-center py-12 space-y-4">
          <p className="text-destructive">Não foi possível carregar a auditoria desta assembleia.</p>
          <Button variant="outline" onClick={() => navigate({ to: "/app/assembleias" })}>Voltar para a lista</Button>
        </div>
      </AppShell>
    );
  }

  const r = resumo.data;

  return (
    <AppShell>
      <TooltipProvider>
        <div className="max-w-7xl space-y-8 animate-augusto-fade-up">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}` as any })}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-serif text-primary tracking-tight">Auditoria e integridade</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {(assembleia.data as any).titulo} • #{(assembleia.data as any).codigo_publico}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" disabled={exportando.isPending} onClick={() => exportando.mutate("votos")}>
                <Download className="h-4 w-4" /> Registro de votos (CSV)
              </Button>
              <Button variant="outline" className="gap-2" disabled={exportando.isPending} onClick={() => exportando.mutate("presenca")}>
                <Download className="h-4 w-4" /> Lista de presença (CSV)
              </Button>
              <Button variant="outline" className="gap-2" disabled={exportando.isPending} onClick={() => exportando.mutate("tentativas")}>
                <Download className="h-4 w-4" /> Tentativas recusadas (CSV)
              </Button>
              <Button variant="augusto" className="gap-2" disabled={exportando.isPending} onClick={() => exportando.mutate("relatorio")}>
                <FileText className="h-4 w-4" /> Exportar relatório de auditoria
              </Button>
            </div>
          </header>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador
              icone={Vote}
              rotulo="Votos registrados"
              valor={resumo.isLoading ? "—" : r?.votos ?? 0}
              nota={
                <>
                  Em {r?.itensComVoto ?? 0} {r?.itensComVoto === 1 ? "item" : "itens"} de pauta.
                  {!!r?.anulados && <> {r.anulados} voto(s) anulado(s) por anulação de item, fora da contagem.</>}
                </>
              }
            />
            <Indicador
              icone={Ban}
              rotulo="Tentativas bloqueadas"
              valor={resumo.isLoading ? "—" : r?.tentativas ?? 0}
              nota={
                r?.topMotivos?.length
                  ? r.topMotivos.map((m: any) => `${m.motivo} (${m.total})`).join(" · ")
                  : "Nenhuma tentativa recusada."
              }
            />
            <Indicador
              icone={integridade && !integridade.integra ? ShieldAlert : ShieldCheck}
              rotulo="Integridade da cadeia"
              alerta={!!integridade && !integridade.integra}
              valor={verificar.isPending ? "Verificando…" : integridade ? (integridade.integra ? "Íntegra" : "Quebrada") : "—"}
              nota={
                integridade
                  ? `Verificada em ${carimbo(integridade.verificadoEm, true)} · ${integridade.totalVotos} votos encadeados.`
                  : r?.ultimaVerificacao
                    ? `Última verificação em ${carimbo(r.ultimaVerificacao.em, true)}.`
                    : "Ainda não verificada."
              }
            >
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-2 h-7 text-xs"
                disabled={verificar.isPending}
                onClick={() => verificar.mutate()}
              >
                <RefreshCw className={cn("h-3 w-3", verificar.isPending && "animate-spin")} /> Verificar integridade
              </Button>
              {integridade && !integridade.integra && (
                <div className="mt-3 text-[11px] text-destructive leading-relaxed">
                  Quebra na sequência <span className="font-mono">{integridade.sequenciaQuebrada}</span>, registro{" "}
                  <span className="font-mono">{integridade.votoId}</span>. Isso significa que algum registro entre o
                  anterior e o seguinte não corresponde ao que foi gravado originalmente.
                </div>
              )}
            </Indicador>
            <Indicador
              icone={Smartphone}
              rotulo="Dispositivos distintos"
              valor={resumo.isLoading ? "—" : r?.dispositivos ?? 0}
              nota={
                (dispositivos.data ?? []).some((d: any) => d.acimaDoEsperado)
                  ? "Há aparelho votando por mais unidades do que o esperado. Ponto de conferência."
                  : "Nenhum aparelho acima do esperado."
              }
            />
          </div>

          <Tabs defaultValue="votos" className="space-y-6">
            <TabsList>
              <TabsTrigger value="votos">Registro de votos</TabsTrigger>
              <TabsTrigger value="tentativas">Tentativas recusadas</TabsTrigger>
              <TabsTrigger value="presencas">Presenças</TabsTrigger>
              <TabsTrigger value="atos">Atos da mesa</TabsTrigger>
              <TabsTrigger value="dispositivos">Dispositivos</TabsTrigger>
            </TabsList>

            {/* Registro de votos */}
            <TabsContent value="votos" className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={itemId ?? undefined} onValueChange={setItemId}>
                  <SelectTrigger className="w-[420px] max-w-full"><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                  <SelectContent>
                    {itens.map((it: any) => (
                      <SelectItem key={it.id} value={it.id}>
                        <span className="inline-flex items-center gap-2">
                          <NumeralRomano n={it.ordem} className="text-augusto-gold" />
                          <span className="truncate">{it.titulo}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {itemAtual && (
                  <h2 className="text-lg font-serif text-primary">
                    Registro de votos, item <NumeralRomano n={itemAtual.ordem} className="text-augusto-gold" />
                  </h2>
                )}
              </div>

              {secreto && (
                <div className="flex items-start gap-2 rounded-md border border-augusto-gold/30 bg-augusto-gold/5 p-3 text-xs text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-augusto-gold shrink-0" />
                  <p>
                    Item secreto: a coluna de unidade não existe, a ordenação é por recibo e o carimbo tem precisão de
                    minuto, porque a ordem cronológica somada à lista de presença permitiria deduzir quem votou o quê.
                  </p>
                </div>
              )}

              {registro.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : registro.error ? (
                <Vazio texto="Erro ao carregar o registro deste item." />
              ) : !registro.data?.linhas.length ? (
                <Vazio texto="Nenhum voto ou tentativa registrada neste item." />
              ) : (
                <Paginado
                  itens={registro.data.linhas}
                  render={(pagina) => (
                    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-augusto-gold/10">
                            <TableHead className="font-bold text-primary">Carimbo</TableHead>
                            {!secreto && <TableHead className="font-bold text-primary">Unidade</TableHead>}
                            <TableHead className="font-bold text-primary">Voto</TableHead>
                            <TableHead className="font-bold text-primary">Origem</TableHead>
                            <TableHead className="font-bold text-primary">Recibo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagina.map((l: any) => (
                            <TableRow
                              key={l.id}
                              className={cn(
                                "border-augusto-gold/10",
                                l.tipo === "tentativa" && "bg-destructive/5 hover:bg-destructive/10",
                              )}
                            >
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                {carimbo(l.criadoEm, secreto)}
                              </TableCell>
                              {!secreto && (
                                <TableCell className="text-xs">
                                  <span className="font-bold text-primary">{l.unidade ?? "—"}</span>
                                  {l.vinculo && <p className="text-[10px] text-muted-foreground">{l.vinculo}</p>}
                                </TableCell>
                              )}
                              <TableCell className="text-xs">
                                {l.tipo === "tentativa" ? (
                                  <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-destructive/15 text-destructive">
                                    Recusado
                                  </span>
                                ) : (
                                  <span className={cn("font-medium", l.invalidado && "line-through text-muted-foreground")}>
                                    {l.opcao}
                                  </span>
                                )}
                                {l.invalidado && (
                                  <p className="text-[10px] text-destructive mt-0.5">
                                    Anulado: {l.invalidadoMotivo ?? "motivo não informado"}
                                    {l.invalidadoPor ? ` · por ${l.invalidadoPor}` : ""}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="font-mono">{l.ipMascarado}</span>
                                <p className="text-[10px] text-muted-foreground">{agenteResumido(l.agente)}</p>
                                {l.tipo === "tentativa" && (
                                  <p className="text-[10px] text-destructive mt-0.5">{l.motivo}</p>
                                )}
                                {l.origem === "mesa" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        tabIndex={0}
                                        className="mt-1 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-augusto-gold/15 text-augusto-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
                                      >
                                        Lançado pela mesa
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      {l.justificativaManual ?? "Sem justificativa registrada."}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {l.origem === "cabine" && (
                                  <span className="mt-1 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary">
                                    Cabine
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {l.tipo === "tentativa" ? (
                                  <span className="text-muted-foreground">tentativa registrada</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="font-mono hover:text-augusto-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded"
                                    onClick={() => {
                                      navigator.clipboard.writeText(l.recibo ?? "");
                                      toast.success("Recibo copiado.");
                                    }}
                                  >
                                    {truncarRecibo(l.recibo)} <Copy className="inline h-3 w-3" />
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                />
              )}
            </TabsContent>

            {/* Tentativas */}
            <TabsContent value="tentativas" className="space-y-4">
              <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
                <SelectTrigger className="w-[320px] max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os motivos</SelectItem>
                  {motivos.map((m: any) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              {tentativas.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !tentativasFiltradas.length ? (
                <Vazio texto="Nenhuma tentativa recusada registrada." />
              ) : (
                <Paginado
                  itens={tentativasFiltradas}
                  render={(pagina) => (
                    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-augusto-gold/10">
                            <TableHead className="font-bold text-primary">Carimbo</TableHead>
                            <TableHead className="font-bold text-primary">Motivo</TableHead>
                            <TableHead className="font-bold text-primary">Unidade</TableHead>
                            <TableHead className="font-bold text-primary">E-mail tentado</TableHead>
                            <TableHead className="font-bold text-primary">Origem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagina.map((t: any) => (
                            <TableRow key={t.id} className="border-augusto-gold/10 bg-destructive/5">
                              <TableCell className="font-mono text-xs whitespace-nowrap">{carimbo(t.criadoEm)}</TableCell>
                              <TableCell className="text-xs">
                                {t.motivo}
                                {t.item && <p className="text-[10px] text-muted-foreground">Item {t.item.ordem} — {t.item.titulo}</p>}
                              </TableCell>
                              <TableCell className="text-xs font-bold text-primary">{t.unidade ?? "—"}</TableCell>
                              <TableCell className="text-xs">{t.email ?? "—"}</TableCell>
                              <TableCell className="text-xs">
                                <span className="font-mono">{t.ipMascarado}</span>
                                <p className="text-[10px] text-muted-foreground">{agenteResumido(t.agente)}</p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                />
              )}
            </TabsContent>

            {/* Presenças */}
            <TabsContent value="presencas" className="space-y-4">
              {(presencas.data?.sessoes.length ?? 0) > 1 && (
                <Select value={sessaoId ?? "todas"} onValueChange={(v) => setSessaoId(v === "todas" ? null : v)}>
                  <SelectTrigger className="w-[320px] max-w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as sessões</SelectItem>
                    {(presencas.data?.sessoes ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        Sessão {s.ordem} — {carimbo(s.data_hora_inicio, true)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {presencas.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !presencas.data?.presencas.length ? (
                <Vazio texto="Nenhuma presença registrada." />
              ) : (
                <Paginado
                  itens={presencas.data.presencas}
                  render={(pagina) => (
                    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-augusto-gold/10">
                            <TableHead className="font-bold text-primary">Unidade</TableHead>
                            <TableHead className="font-bold text-primary">Tipo</TableHead>
                            <TableHead className="font-bold text-primary">Representante</TableHead>
                            <TableHead className="font-bold text-primary">Entrada</TableHead>
                            <TableHead className="font-bold text-primary">Saída</TableHead>
                            <TableHead className="font-bold text-primary">Origem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagina.map((p: any) => (
                            <TableRow key={p.id} className="border-augusto-gold/10">
                              <TableCell className="text-xs font-bold text-primary">{p.unidade}</TableCell>
                              <TableCell className="text-xs capitalize">{p.tipo}</TableCell>
                              <TableCell className="text-xs">{p.representante ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{carimbo(p.entrada)}</TableCell>
                              <TableCell className="font-mono text-xs">{p.saida ? carimbo(p.saida) : "—"}</TableCell>
                              <TableCell className="text-xs capitalize">{p.origem}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                />
              )}
            </TabsContent>

            {/* Atos da mesa */}
            <TabsContent value="atos" className="space-y-4">
              {atos.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !atos.data?.length ? (
                <Vazio texto="Nenhum ato da mesa registrado para esta assembleia." />
              ) : (
                <Paginado
                  itens={atos.data}
                  render={(pagina) => (
                    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-augusto-gold/10">
                            <TableHead className="font-bold text-primary">Horário</TableHead>
                            <TableHead className="font-bold text-primary">Ato</TableHead>
                            <TableHead className="font-bold text-primary">Autor</TableHead>
                            <TableHead className="font-bold text-primary">Detalhe</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagina.map((a: any) => (
                            <TableRow key={a.id} className="border-augusto-gold/10">
                              <TableCell className="font-mono text-xs whitespace-nowrap">{carimbo(a.em)}</TableCell>
                              <TableCell className="text-xs">
                                {acaoLegivel(a.acao) === a.acao ? a.acao : acaoLegivel(a.acao)}
                                {a.item && <p className="text-[10px] text-muted-foreground">{a.item}</p>}
                              </TableCell>
                              <TableCell className="text-xs">{a.autor}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{a.detalhe ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                />
              )}
            </TabsContent>

            {/* Dispositivos */}
            <TabsContent value="dispositivos" className="space-y-4">
              <Card className="border-augusto-gold/20 bg-augusto-gold/[0.03]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif text-primary">Sobre a marcação de dispositivo</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground leading-relaxed">
                  A impressão de dispositivo é um sinal fraco. Marido e mulher com duas unidades usando o mesmo celular
                  é situação comum e legítima, assim como o portador de procurações votando pelo próprio aparelho. A
                  marcação é ponto de conferência, nunca acusação. Nada é bloqueado com base nesse sinal.
                </CardContent>
              </Card>
              {dispositivos.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : !dispositivos.data?.length ? (
                <Vazio texto="Nenhum dispositivo registrado." />
              ) : (
                <Paginado
                  itens={dispositivos.data}
                  render={(pagina) => (
                    <div className="rounded-md border border-augusto-gold/10 overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="hover:bg-transparent border-augusto-gold/10">
                            <TableHead className="font-bold text-primary">Impressão</TableHead>
                            <TableHead className="font-bold text-primary">Unidades</TableHead>
                            <TableHead className="font-bold text-primary">Quais</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagina.map((d: any) => (
                            <TableRow key={d.hash} className={cn("border-augusto-gold/10", d.acimaDoEsperado && "bg-augusto-gold/[0.06]")}>
                              <TableCell className="font-mono text-xs">{truncarRecibo(d.hash)}</TableCell>
                              <TableCell className={cn("text-xs font-bold", d.acimaDoEsperado ? "text-augusto-gold" : "text-primary")}>
                                {d.total}
                                {d.acimaDoEsperado && <span className="ml-2 text-[10px] uppercase tracking-widest">conferir</span>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{d.unidades.join(", ") || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </AppShell>
  );
}
