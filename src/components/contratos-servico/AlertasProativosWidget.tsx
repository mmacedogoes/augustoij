import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
  AlertCircle,
  Calculator,
  FileText,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Copy,
  ChevronRight,
  Building,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getAlertasProativosContratos,
  simularCalculoReajusteProativo,
  type ItemAlertaProativo,
} from "@/lib/contratos-servico/alertas-proativos.functions";
import { formatBRL } from "@/lib/imoveis/masks";

export function AlertasProativosWidget({
  condominioId,
  className,
}: {
  condominioId?: string | null;
  className?: string;
}) {
  const getAlertas = useServerFn(getAlertasProativosContratos);
  const simularFn = useServerFn(simularCalculoReajusteProativo);

  const [filtroTipo, setFiltroTipo] = useState<"todos" | "vencimentos" | "reajustes" | "aviso_previo">("todos");
  const [modalReajuste, setModalReajuste] = useState<ItemAlertaProativo | null>(null);
  const [simulacaoResultado, setSimulacaoResultado] = useState<any | null>(null);
  const [calculando, setCalculando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["alertas-proativos-contratos", condominioId],
    queryFn: () => getAlertas({ data: { condominioId: condominioId || null } }),
  });

  const metricas = data?.metricas;
  const alertas = (data?.alertas ?? []).filter((a) => {
    if (filtroTipo === "vencimentos") {
      return a.tipoAlerta === "vencido" || a.tipoAlerta.startsWith("vencendo_");
    }
    if (filtroTipo === "reajustes") {
      return a.tipoAlerta === "reajuste_devido";
    }
    if (filtroTipo === "aviso_previo") {
      return a.tipoAlerta === "aviso_previo_critico";
    }
    return true;
  });

  async function abrirSimulacao(alerta: ItemAlertaProativo) {
    setModalReajuste(alerta);
    setSimulacaoResultado(null);
    setCalculando(true);
    try {
      const res = await simularFn({
        data: {
          valorAtual: alerta.valorMensal || 1000,
          mesBase: new Date().getMonth() + 1,
          indiceContratual: "igpm",
          nomeParte: alerta.prestadorOuInquilino,
        },
      });
      setSimulacaoResultado(res);
    } catch (e) {
      toast.error("Não foi possível consultar a série histórica do BCB no momento.");
    } finally {
      setCalculando(false);
    }
  }

  function copiarMinuta(texto: string) {
    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success("Minuta de notificação copiada para a área de transferência."))
      .catch(() => toast.error("Erro ao copiar texto."));
  }

  return (
    <div className={className}>
      {/* 1. Barra Superior de Métricas Pró-Ativas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <Card
          onClick={() => setFiltroTipo((prev) => (prev === "vencimentos" ? "todos" : "vencimentos"))}
          className={`p-3.5 cursor-pointer transition border-l-4 border-l-rose-500 hover:shadow-sm ${
            filtroTipo === "vencimentos" ? "ring-2 ring-rose-500/20 bg-rose-50/20" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
              Vencendo ≤ 30d
            </span>
            <Badge variant="outline" className="text-xs text-rose-600 border-rose-200 bg-rose-50 font-bold">
              {(metricas?.servicosVencendo30d ?? 0) + (metricas?.servicosVencidos ?? 0)}
            </Badge>
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">
            {(metricas?.servicosVencendo30d ?? 0) + (metricas?.servicosVencidos ?? 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {metricas?.servicosVencidos ?? 0} já vencidos
          </p>
        </Card>

        <Card
          onClick={() => setFiltroTipo((prev) => (prev === "vencimentos" ? "todos" : "vencimentos"))}
          className={`p-3.5 cursor-pointer transition border-l-4 border-l-amber-500 hover:shadow-sm ${
            filtroTipo === "vencimentos" ? "ring-2 ring-amber-500/20 bg-amber-50/20" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Vencendo 60–90d
            </span>
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50 font-bold">
              {(metricas?.servicosVencendo60d ?? 0) + (metricas?.servicosVencendo90d ?? 0)}
            </Badge>
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">
            {(metricas?.servicosVencendo60d ?? 0) + (metricas?.servicosVencendo90d ?? 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Planejar renovação</p>
        </Card>

        <Card
          onClick={() => setFiltroTipo((prev) => (prev === "reajustes" ? "todos" : "reajustes"))}
          className={`p-3.5 cursor-pointer transition border-l-4 border-l-blue-500 hover:shadow-sm ${
            filtroTipo === "reajustes" ? "ring-2 ring-blue-500/20 bg-blue-50/20" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              Reajustes Devidos
            </span>
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50 font-bold">
              {metricas?.servicosReajustesPendentes ?? 0}
            </Badge>
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">
            {metricas?.servicosReajustesPendentes ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Índices BCB disponíveis</p>
        </Card>

        <Card
          onClick={() => setFiltroTipo((prev) => (prev === "aviso_previo" ? "todos" : "aviso_previo"))}
          className={`p-3.5 cursor-pointer transition border-l-4 border-l-augusto-gold hover:shadow-sm ${
            filtroTipo === "aviso_previo" ? "ring-2 ring-augusto-gold/20 bg-augusto-gold/5" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-augusto-gold" />
              Aviso Prévio
            </span>
            <Badge variant="outline" className="text-xs text-augusto-gold border-augusto-gold/30 bg-augusto-gold/10 font-bold">
              {metricas?.servicosAvisoPrevioCritico ?? 0}
            </Badge>
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">
            {metricas?.servicosAvisoPrevioCritico ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Prazo rescisório crítico</p>
        </Card>
      </div>

      {/* 2. Lista de Alertas e Ações Recomendadas */}
      <Card className="overflow-hidden">
        <div className="p-3.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-augusto-gold" />
            <h3 className="text-sm font-semibold text-foreground">
              Alertas Pró-Ativos e Ciclo de Vida ({alertas.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={filtroTipo === "todos" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setFiltroTipo("todos")}
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "vencimentos" ? "secondary" : "ghost"}
              className="h-7 text-xs text-rose-600"
              onClick={() => setFiltroTipo("vencimentos")}
            >
              Vencimentos
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "reajustes" ? "secondary" : "ghost"}
              className="h-7 text-xs text-blue-600"
              onClick={() => setFiltroTipo("reajustes")}
            >
              Reajustes
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "aviso_previo" ? "secondary" : "ghost"}
              className="h-7 text-xs text-augusto-gold"
              onClick={() => setFiltroTipo("aviso_previo")}
            >
              Aviso Prévio
            </Button>
          </div>
        </div>

        <div className="divide-y divide-border/60">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Carregando ciclo de vida dos contratos…
            </div>
          ) : alertas.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-augusto-green mx-auto mb-2 opacity-80" />
              Nenhuma pendência crítica ou vencimento próximo no momento. Todos os contratos estão em dia!
            </div>
          ) : (
            alertas.slice(0, 10).map((alerta) => (
              <div
                key={alerta.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/15 transition"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold uppercase ${
                        alerta.prioridade === "alta"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : alerta.prioridade === "media"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {alerta.tipoAlerta.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {alerta.condominioNome}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-foreground">{alerta.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">{alerta.subtitulo}</p>
                  <p className="text-[11px] text-augusto-gold font-medium pt-0.5">
                    💡 Ação recomendada: {alerta.acaoRecomendada}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {alerta.tipoAlerta === "reajuste_devido" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => abrirSimulacao(alerta)}
                    >
                      <Calculator className="h-3 w-3" />
                      Simular Reajuste
                    </Button>
                  )}

                  <Link to={alerta.linkDestino as any}>
                    <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
                      <span>Gerenciar</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 3. Modal Interativo de Simulação de Reajuste */}
      <Dialog open={!!modalReajuste} onOpenChange={(open) => !open && setModalReajuste(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-augusto-gold" />
              Cálculo de Reajuste — {modalReajuste?.prestadorOuInquilino}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Variação calculada pelo Sistema Gerenciador de Séries Temporais do Banco Central do Brasil (BACEN).
            </DialogDescription>
          </DialogHeader>

          {calculando ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Consultando série histórica oficial do BCB…
            </div>
          ) : simulacaoResultado ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border">
                <div>
                  <span className="text-muted-foreground text-[11px]">Valor Atual:</span>
                  <p className="font-bold text-sm text-foreground">
                    {formatBRL(simulacaoResultado.valorAtual)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Variação Apurada:</span>
                  <p className="font-bold text-sm text-blue-600">
                    {simulacaoResultado.percentualAplicado >= 0 ? "+" : ""}
                    {simulacaoResultado.percentualAplicado.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Novo Valor Sugerido:</span>
                  <p className="font-bold text-sm text-augusto-green">
                    {formatBRL(simulacaoResultado.valorReajustado)}
                  </p>
                </div>
              </div>

              {simulacaoResultado.substituicaoPorNegativo && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-700 dark:text-amber-300 text-[11px]">
                  ⚠️ O índice contratual (IGP-M) acumulou deflação negativa no período. Sugere-se a aplicação da variação do IPCA para preservação do equilíbrio econômico-financeiro.
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">
                    Minuta de Notificação Pronta para Envio:
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => copiarMinuta(simulacaoResultado.minutaComunicado)}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar Minuta
                  </Button>
                </div>
                <div className="p-3 bg-background border rounded font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {simulacaoResultado.minutaComunicado}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum dado retornado para este cálculo.</p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalReajuste(null)}>
              Fechar
            </Button>
            {simulacaoResultado && (
              <Button
                size="sm"
                onClick={() => {
                  copiarMinuta(simulacaoResultado.minutaComunicado);
                  setModalReajuste(null);
                }}
              >
                Copiar e Concluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
