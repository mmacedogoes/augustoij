import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Scale,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Clock,
  BookOpen,
} from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getUltimaAvaliacaoBenchmark,
  rodarBenchmarkCompleto,
  rodarAvaliacaoCasoIndividual,
  type JudgeEvaluationResult,
  type BenchmarkSuiteSummary,
} from "@/lib/admin-avaliacao.functions";

export const Route = createFileRoute("/_authenticated/app/admin/avaliacao")({
  component: AdminAvaliacaoPage,
});

function getStatusBadge(status: JudgeEvaluationResult["status"]) {
  switch (status) {
    case "excelente":
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/25">Excelente (A+)</Badge>;
    case "aprovado":
      return <Badge className="bg-primary/15 text-primary border-primary/25">Aprovado</Badge>;
    case "atencao":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/25">Atenção</Badge>;
    case "reprovado":
      return <Badge className="bg-destructive/15 text-destructive border-destructive/25">Reprovado</Badge>;
  }
}

function AdminAvaliacaoPage() {
  const queryClient = useQueryClient();
  const fetchUltimaFn = useServerFn(getUltimaAvaliacaoBenchmark);
  const rodarTodosFn = useServerFn(rodarBenchmarkCompleto);
  const rodarCasoFn = useServerFn(rodarAvaliacaoCasoIndividual);

  const [casoSelecionado, setCasoSelecionado] = useState<JudgeEvaluationResult | null>(null);

  const { data: suite, isLoading } = useQuery<BenchmarkSuiteSummary>({
    queryKey: ["admin-avaliacao-benchmark"],
    queryFn: () => fetchUltimaFn(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const mutationRodarTodos = useMutation({
    mutationFn: () => rodarTodosFn(),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-avaliacao-benchmark"], data);
      toast.success("Benchmark completo executado com sucesso!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao rodar benchmark.");
    },
  });

  const mutationRodarCaso = useMutation({
    mutationFn: (casoId: string) => rodarCasoFn({ data: { casoId } }),
    onSuccess: (updatedCaso) => {
      queryClient.setQueryData(["admin-avaliacao-benchmark"], (prev: BenchmarkSuiteSummary | undefined) => {
        if (!prev) return prev;
        const avaliacoes = prev.avaliacoes.map((a) => (a.casoId === updatedCaso.casoId ? updatedCaso : a));
        return {
          ...prev,
          avaliacoes,
        };
      });
      if (casoSelecionado?.casoId === updatedCaso.casoId) {
        setCasoSelecionado(updatedCaso);
      }
      toast.success(`Caso "${updatedCaso.tituloCaso}" reavaliado com nota ${updatedCaso.notaGeral}/10!`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao reavaliar caso.");
    },
  });

  return (
    <>
      <div className="max-w-6xl space-y-6">
        <header className="app-page-header">
          <span className="app-eyebrow">Administração & Inteligência Jurídica</span>
          <h1 className="app-title">Avaliação de IA (LLM-as-Judge)</h1>
          <p className="app-subtitle">
            Suíte de benchmarking contínuo para auditoria da qualidade jurídica, fidelidade fática,
            precisão de artigos normativos e conformidade procedimental do assistente.
          </p>
        </header>

        <AdminNav />

        {/* Top Actions & Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Golden Dataset Jurídico Condominial
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                Última auditoria:{" "}
                {suite ? new Date(suite.executadoEm).toLocaleString("pt-BR") : "Carregando..."}
              </p>
            </div>
          </div>

          <Button
            onClick={() => mutationRodarTodos.mutate()}
            disabled={mutationRodarTodos.isPending}
            className="gap-2 shrink-0"
          >
            {mutationRodarTodos.isPending ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" /> Auditando com Juiz LLM...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" /> Executar Benchmark Completo
              </>
            )}
          </Button>
        </div>

        {/* Scorecards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Score Global
              </span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            {isLoading || !suite ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{suite.notaMediaGeral}</span>
                <span className="text-xs text-muted-foreground">/ 10</span>
                <div className="ml-auto">{getStatusBadge(suite.statusGeral)}</div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Taxa de Aprovação: {suite?.taxaAprovacaoPercentual ?? 100}%
            </p>
          </Card>

          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fidelidade Fática
              </span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            {isLoading || !suite ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {suite.mediasDimensoes.fidelidadeFatica}
                </span>
                <span className="text-xs text-muted-foreground">/ 10</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Adesão irrestrita ao fato & unidade solicitada
            </p>
          </Card>

          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Precisão Normativa
              </span>
              <FileCheck className="h-4 w-4 text-primary" />
            </div>
            {isLoading || !suite ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {suite.mediasDimensoes.precisaoNormativa}
                </span>
                <span className="text-xs text-muted-foreground">/ 10</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Citação nominal de artigos da convenção
            </p>
          </Card>

          <Card className="p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tom & Procedimento
              </span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            {isLoading || !suite ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {suite.mediasDimensoes.tomJuridicoClareza}
                </span>
                <span className="text-xs text-muted-foreground">/ 10</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Elegância formal e prazos de defesa
            </p>
          </Card>
        </div>

        {/* Test Cases Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Casos de Teste do Benchmark ({suite?.totalCasos ?? 0})
            </h3>
            <span className="text-xs text-muted-foreground">
              Avaliados com base nas diretrizes AAS Core e legislação condominial
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suite?.avaliacoes.map((item) => (
              <Card
                key={item.casoId}
                className="p-5 flex flex-col justify-between border border-border hover:border-primary/40 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.categoria}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground mt-1.5">
                        {item.tituloCaso}
                      </h4>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/50 text-xs text-muted-foreground font-mono">
                    <span className="font-semibold text-foreground">Prompt: </span>
                    "{item.casoId === "notif_barulho_101" ? "Redija notificação por barulho após 22h para unidade 101..." : item.tituloCaso}"
                  </div>

                  {/* Sub-dimension bars */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Fidelidade</span>
                        <span className="font-medium text-foreground">{item.dimensoes.fidelidadeFatica}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(item.dimensoes.fidelidadeFatica / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Normas</span>
                        <span className="font-medium text-foreground">{item.dimensoes.precisaoNormativa}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(item.dimensoes.precisaoNormativa / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Tom Jurídico</span>
                        <span className="font-medium text-foreground">{item.dimensoes.tomJuridicoClareza}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(item.dimensoes.tomJuridicoClareza / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Procedimento</span>
                        <span className="font-medium text-foreground">{item.dimensoes.procedimentoDefesa}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${(item.dimensoes.procedimentoDefesa / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCasoSelecionado(item)}
                    className="text-xs"
                  >
                    Ver Auditoria do Juiz
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mutationRodarCaso.mutate(item.casoId)}
                    disabled={mutationRodarCaso.isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCw className={`h-3.5 w-3.5 mr-1 ${mutationRodarCaso.isPending ? "animate-spin" : ""}`} />
                    Reavaliar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Modal de Detalhes da Auditoria */}
        <Dialog open={!!casoSelecionado} onOpenChange={(open) => !open && setCasoSelecionado(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                {casoSelecionado && getStatusBadge(casoSelecionado.status)}
                <span className="text-xs text-muted-foreground capitalize">
                  {casoSelecionado?.categoria}
                </span>
              </div>
              <DialogTitle className="text-lg mt-1">
                {casoSelecionado?.tituloCaso}
              </DialogTitle>
              <DialogDescription>
                Auditoria detalhada gerada pelo Juiz LLM sobre a qualidade da resposta do assistente.
              </DialogDescription>
            </DialogHeader>

            {casoSelecionado && (
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-lg bg-muted/60 border border-border">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-primary" /> Veredito do Juiz LLM (Nota {casoSelecionado.notaGeral}/10)
                  </h4>
                  <p className="text-xs text-foreground mt-2 leading-relaxed">
                    {casoSelecionado.justificativaJudge}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Pontos Fortes Observados
                  </h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {casoSelecionado.pontosFortes.map((pf, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{pf}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" /> Exemplo de Resposta Auditada
                  </h4>
                  <pre className="p-3 rounded-md bg-muted text-[11px] font-mono whitespace-pre-wrap text-foreground max-h-48 overflow-y-auto border border-border">
                    {casoSelecionado.respostaGeradaExemplo}
                  </pre>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => setCasoSelecionado(null)}>
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => mutationRodarCaso.mutate(casoSelecionado.casoId)}
                    disabled={mutationRodarCaso.isPending}
                  >
                    Reavaliar Este Caso
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
