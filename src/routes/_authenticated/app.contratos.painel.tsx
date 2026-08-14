import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileText, Loader2,
  Plus, ShieldAlert, TrendingUp, Info, ArrowRight, Wallet, Activity,
  UserX, FileWarning, Search,
} from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
import { GestaoContratosGate } from "@/components/gates/GestaoContratosGate";
import {
  getIndicadoresPainel,
  listChecklistsPendentesMes,
  listNaoConformidadesTrabalhistasMes,
  type IndicadoresPainel,
  type ChecklistPendenteMes,
  type NaoConformidadeMes,
} from "@/lib/contratos-servico/painel.functions";
import {
  listPendenciasReajuste,
  type PendenciaReajuste,
} from "@/lib/contratos-servico/reajustes.functions";
import {
  listEventosProximos30Dias,
  type EventoProximo,
} from "@/lib/contratos-servico/eventos.functions";
import { listCondominiosParaContratos } from "@/lib/contratos-servico/contratos.functions";
import { etiquetaTipoEvento, type TipoEvento } from "@/lib/contratos-servico/eventos-core";
import { rotuloIndiceContrato } from "@/lib/contratos-servico/indices";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PendenciasDrawer, type PendenciaTipo } from "@/components/contratos-servico/PendenciasDrawer";

const TODOS = "__todos";

export const Route = createFileRoute("/_authenticated/app/contratos/painel")({
  validateSearch: (raw) => z.object({ cid: z.string().uuid().optional() }).parse(raw),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [condominioId, setCondominioId] = useState<string>(search.cid ?? TODOS);
  const condFiltro = condominioId === TODOS ? null : condominioId;

  const condosFn = useServerFn(listCondominiosParaContratos);
  const indicadoresFn = useServerFn(getIndicadoresPainel);
  const reajustesFn = useServerFn(listPendenciasReajuste);
  const eventosFn = useServerFn(listEventosProximos30Dias);
  const checklistsFn = useServerFn(listChecklistsPendentesMes);
  const ncFn = useServerFn(listNaoConformidadesTrabalhistasMes);

  const [condos, setCondos] = useState<Array<{ id: string; nome: string }>>([]);
  const [ind, setInd] = useState<IndicadoresPainel | null>(null);
  const [reaj, setReaj] = useState<PendenciaReajuste[] | null>(null);
  const [eventos, setEventos] = useState<EventoProximo[] | null>(null);
  const [checklists, setChecklists] = useState<ChecklistPendenteMes[] | null>(null);
  const [ncs, setNcs] = useState<NaoConformidadeMes[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendenciaFiltro, setPendenciaFiltro] = useState<PendenciaTipo>();

  useEffect(() => {
    condosFn()
      .then((r) => setCondos(r.rows as Array<{ id: string; nome: string }>))
      .catch((e: Error) => toast.error(e.message));
  }, [condosFn]);

  useEffect(() => {
    setInd(null); setReaj(null); setEventos(null); setChecklists(null); setNcs(null);
    const payload = { data: { condominioId: condFiltro } };
    indicadoresFn(payload).then(setInd).catch((e: Error) => toast.error(e.message));
    reajustesFn(payload).then((r) => setReaj(r.rows)).catch((e: Error) => toast.error(e.message));
    eventosFn().then((r) => setEventos(r.rows)).catch((e: Error) => toast.error(e.message));
    checklistsFn(payload).then((r) => setChecklists(r.rows)).catch((e: Error) => toast.error(e.message));
    ncFn(payload).then((r) => setNcs(r.rows)).catch((e: Error) => toast.error(e.message));
  }, [condFiltro, indicadoresFn, reajustesFn, eventosFn, checklistsFn, ncFn]);

  function handleOpenPendencia(tipo: PendenciaTipo) {
    setPendenciaFiltro(tipo);
    setDrawerOpen(true);
  }

  function handleCondominio(v: string) {
    setCondominioId(v);
    navigate({
      to: "/app/contratos/painel",
      search: v === TODOS ? {} : { cid: v },
      replace: true,
    });
  }

  const pendenciasPrincipais = useMemo(() => {
    const list: Array<{ 
      tipo: string; 
      icon: React.ReactNode; 
      qtd: number; 
      tone: "ambar" | "vermelho"; 
      cta: string; 
      key: PendenciaTipo 
    }> = [];
    
    if (ind?.reajustes_pendentes) {
      list.push({
        tipo: "Reajustes pendentes",
        icon: <TrendingUp className="h-4 w-4" />,
        qtd: ind.reajustes_pendentes,
        tone: "ambar",
        cta: "Revisar reajustes",
        key: "reajuste",
      });
    }
    if (ind?.checklists_pendentes_mes) {
      list.push({
        tipo: "Checklists pendentes",
        icon: <ClipboardList className="h-4 w-4" />,
        qtd: ind.checklists_pendentes_mes,
        tone: "ambar",
        cta: "Ver checklists",
        key: "checklist",
      });
    }
    if (ind?.nao_conformidades_mes) {
      list.push({
        tipo: "Não conformidades",
        icon: <ShieldAlert className="h-4 w-4" />,
        qtd: ind.nao_conformidades_mes,
        tone: "vermelho",
        cta: "Tratar pendências",
        key: "nao_conformidade",
      });
    }
    if (ind?.sem_responsavel) {
      list.push({
        tipo: "Contratos sem responsável",
        icon: <UserX className="h-4 w-4" />,
        qtd: ind.sem_responsavel,
        tone: "ambar",
        cta: "Atribuir gestores",
        key: "sem_responsavel",
      });
    }
    if (ind?.sem_indice) {
      list.push({
        tipo: "Sem índice de reajuste",
        icon: <FileWarning className="h-4 w-4" />,
        qtd: ind.sem_indice,
        tone: "ambar",
        cta: "Configurar índices",
        key: "sem_indice",
      });
    }
    if (ind?.mes_base_ausente) {
      list.push({
        tipo: "Mês-base ausente",
        icon: <CalendarClock className="h-4 w-4" />,
        qtd: ind.mes_base_ausente,
        tone: "ambar",
        cta: "Definir datas",
        key: "mes_base_ausente",
      });
    }
    if (ind?.documentos_ausentes) {
      list.push({
        tipo: "Documentos ausentes",
        icon: <FileText className="h-4 w-4" />,
        qtd: ind.documentos_ausentes,
        tone: "ambar",
        cta: "Fazer upload",
        key: "documento_ausente",
      });
    }
    return list;
  }, [ind]);

  return (
    <>
      <GestaoContratosGate requerePainelConsolidado>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <header className="app-page-header min-w-0">
            <span className="app-eyebrow">Gestão de Contratos</span>
            <h1 className="app-title">Painel</h1>
            <p className="app-subtitle max-w-xl">
              Central de comando da carteira de contratos.
            </p>
          </header>
          <div className="flex flex-wrap items-center gap-3">
            <ContratosTabs condominioId={condFiltro} />
            <Button size="sm" variant="augusto" asChild>
              <Link to="/app/contratos/novo"><Plus className="h-4 w-4 mr-1" /> Novo contrato</Link>
            </Button>
          </div>
        </div>

        <div className="max-w-sm">
          <Select value={condominioId} onValueChange={handleCondominio}>
            <SelectTrigger className="bg-card border-augusto-gold/20"><SelectValue placeholder="Condomínio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os condomínios</SelectItem>
              {condos.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Faixa de Saúde da Carteira */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <HealthCard 
            label="Contratos Vigentes" 
            value={ind?.vigentes} 
            icon={<CheckCircle2 className="h-5 w-5 text-augusto-green" />} 
          />
          <HealthCard 
            label="Exige Atenção" 
            value={ind?.total_com_pendencias} 
            icon={<AlertTriangle className="h-5 w-5 text-augusto-gold" />} 
            tone={ind?.total_com_pendencias ? "ambar" : "neutro"}
          />
          <HealthCard 
            label="Vencidos/Críticos" 
            value={(ind?.vencidos ?? 0) + (ind?.nao_conformidades_mes ?? 0)} 
            icon={<ShieldAlert className="h-5 w-5 text-destructive" />} 
            tone={(ind?.vencidos ?? 0) + (ind?.nao_conformidades_mes ?? 0) > 0 ? "vermelho" : "neutro"}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Card className="app-card p-4 border-augusto-gold/10 bg-gradient-to-br from-card to-augusto-gold/[0.03] cursor-help hover:border-augusto-gold/30 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor Anual Estimado</span>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-xl font-serif text-primary">
                  {ind === null ? "…" : formatBRL(ind.valor_anual_estimado)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Recorrente: {ind ? formatBRL(ind.valor_mensal_total) : "—"}/mês
                </p>
              </Card>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-3">
                <h4 className="font-serif font-medium text-primary">Composição do Valor Anual</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border pb-1">
                    <span className="text-muted-foreground">Mensais (x12)</span>
                    <span className="font-medium">{ind ? formatBRL(ind.valor_mensal_total * 12) : "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-1">
                    <span className="text-muted-foreground">Contratos Globais</span>
                    <span className="font-medium">{ind ? formatBRL(ind.valor_global_total) : "—"}</span>
                  </div>
                  <div className="flex justify-between pt-1 font-semibold text-augusto-green">
                    <span>Total Estimado</span>
                    <span>{ind ? formatBRL(ind.valor_anual_estimado) : "—"}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Considera apenas contratos ativos. Contratos sem valor definido são ignorados no cálculo.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            {/* Bloco: Requer Atenção Agora (Lista Densa) */}
            <Card className="app-card border-augusto-gold/30">
              <div className="p-5 border-b border-augusto-gold/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-augusto-gold" />
                  <h2 className="text-lg font-serif text-primary">Requer atenção agora</h2>
                </div>
                {ind?.total_com_pendencias ? (
                  <span className="text-xs font-medium text-augusto-gold bg-augusto-gold/10 px-2 py-0.5 rounded-full">
                    {ind.total_com_pendencias} pendências
                  </span>
                ) : null}
              </div>
              <div className="divide-y divide-augusto-gold/5">
                {ind === null ? (
                  <div className="p-10"><Loading /></div>
                ) : pendenciasPrincipais.length === 0 ? (
                  <div className="p-10 text-center">
                    <CheckCircle2 className="h-10 w-10 text-augusto-green mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-muted-foreground">Tudo em dia! Nenhuma pendência crítica encontrada.</p>
                  </div>
                ) : (
                  pendenciasPrincipais.map((p, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          p.tone === "ambar" ? "bg-augusto-gold/15 text-augusto-gold" : "bg-destructive/15 text-destructive"
                        )}>
                          {p.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-primary">{p.tipo}</p>
                          <p className="text-xs text-muted-foreground">{p.qtd} {p.qtd === 1 ? "item identificado" : "itens identificados"}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-augusto-gold hover:text-augusto-gold hover:bg-augusto-gold/10" 
                        onClick={() => handleOpenPendencia(p.key)}
                      >
                        {p.cta} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Bloco titulo="Eventos da Agenda" icon={<CalendarClock className="h-4 w-4" />}>
              {eventos === null ? (
                <Loading />
              ) : eventos.length === 0 ? (
                <Vazio texto="Nenhum evento previsto nos próximos 30 dias." />
              ) : (
                <AgendaAgrupada rows={eventos} />
              )}
            </Bloco>
          </div>

          <aside className="space-y-6">
            <Card className="app-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-augusto-green" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Distribuição da Carteira</h3>
              </div>
              {ind === null ? (
                <Loading />
              ) : ind.distribuicao_tipos.length === 0 ? (
                <Vazio texto="Nenhum contrato ativo." />
              ) : (
                <DistribuicaoBarras rows={ind.distribuicao_tipos} />
              )}
            </Card>

            <Card className="app-card p-5 bg-augusto-green/[0.02] border-augusto-green/10">
              <h3 className="text-sm font-semibold text-primary mb-2">Dica do Augusto</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mantenha os campos "Mês-base" e "Índice de Reajuste" preenchidos para que eu possa gerar lembretes automáticos na sua agenda.
              </p>
            </Card>
          </aside>
        </div>
      </div>
      </GestaoContratosGate>
      <PendenciasDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        tipoFiltro={pendenciaFiltro}
        condominioId={condFiltro}
      />
    </>
  );
}

function HealthCard({ 
  label, value, icon, tone = "neutro" 
}: { 
  label: string; value: number | undefined; icon: React.ReactNode; tone?: "neutro" | "ambar" | "vermelho" 
}) {
  return (
    <Card className={cn(
      "app-card p-4 flex flex-col justify-between h-full transition-all border-l-4",
      tone === "neutro" ? "border-l-border bg-card" : 
      tone === "ambar" ? "border-l-augusto-gold bg-augusto-gold/[0.02]" : 
      "border-l-destructive bg-destructive/[0.02]"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-serif text-primary">
        {value === undefined ? "…" : value}
      </p>
    </Card>
  );
}

function Bloco({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="app-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
        <span className="text-augusto-green">{icon}</span>
        <h2 className="text-lg font-serif text-primary">{titulo}</h2>
      </div>
      {children}
    </Card>
  );
}

function Loading() {
  return <AppSkeletonLines lines={3} />;
}
function Vazio({ texto }: { texto: string }) {
  return <AppEmptyState title={texto} />;
}

function AgendaAgrupada({ rows }: { rows: EventoProximo[] }) {
  const grupos = useMemo(() => {
    const map = new Map<string, EventoProximo[]>();
    for (const r of rows) {
      const arr = map.get(r.data_evento) ?? [];
      arr.push(r);
      map.set(r.data_evento, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  return (
    <div className="space-y-4">
      {grupos.slice(0, 8).map(([dia, itens]) => (
        <div key={dia} className="relative pl-4 border-l border-augusto-gold/20">
          <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-augusto-gold/20 border border-augusto-gold/40" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{formatDate(dia)}</p>
          <ul className="space-y-2">
            {itens.map((it) => (
              <li key={it.id}>
                <Link
                  to="/app/contratos/$contratoId"
                  params={{ contratoId: it.contrato_id }}
                  className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 hover:border-augusto-gold/30 hover:shadow-sm transition-all group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-augusto-gold transition-colors">{it.titulo}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {it.prestador_nome} · {it.condominio_nome}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                    {etiquetaTipoEvento(it.tipo as TipoEvento)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function DistribuicaoBarras({ rows }: { rows: Array<{ tipo_id: string | null; nome: string; total: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.tipo_id ?? r.nome}>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-primary">{r.nome}</span>
            <span className="text-muted-foreground">{r.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-augusto-green transition-all duration-500"
              style={{ width: `${(r.total / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
