import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileText, Loader2,
  Plus, ShieldAlert, TrendingUp,
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

  function handleCondominio(v: string) {
    setCondominioId(v);
    navigate({
      to: "/app/contratos/painel",
      search: v === TODOS ? {} : { cid: v },
      replace: true,
    });
  }

  return (
    <AppShell>
      <GestaoContratosGate>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="app-eyebrow">Gestão de Contratos</p>
            <h1 className="mt-1.5 font-serif text-3xl leading-tight text-primary sm:text-4xl">
              Painel
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Visão consolidada das pendências, agenda e não conformidades da carteira.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ContratosTabs condominioId={condFiltro} />
            <Button size="sm" variant="augusto" asChild>
              <Link to="/app/contratos/novo"><Plus className="h-4 w-4 mr-1" /> Novo contrato</Link>
            </Button>
          </div>
        </div>

        <div className="mb-4 max-w-sm">
          <Select value={condominioId} onValueChange={handleCondominio}>
            <SelectTrigger><SelectValue placeholder="Condomínio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os condomínios</SelectItem>
              {condos.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-4">
          <Kpi to="/app/contratos" label="Vigentes" value={ind?.vigentes} icon={<CheckCircle2 className="h-4 w-4" />} tone="neutro" />
          <Kpi to="/app/contratos" label="Vencendo em 90 dias" value={ind?.vencendo_90d} icon={<CalendarClock className="h-4 w-4" />} tone="ambar" />
          <Kpi to="/app/contratos" label="Vencidos" value={ind?.vencidos} icon={<AlertTriangle className="h-4 w-4" />} tone="vermelho" />
          <Kpi to="/app/contratos/painel" label="Reajustes pendentes" value={ind?.reajustes_pendentes} icon={<TrendingUp className="h-4 w-4" />} tone="ambar" />
          <Kpi to="/app/contratos/painel" label="Checklists do mês pendentes" value={ind?.checklists_pendentes_mes} icon={<ClipboardList className="h-4 w-4" />} tone="ambar" />
          <Kpi to="/app/contratos/painel" label="Não conformidades trabalhistas" value={ind?.nao_conformidades_mes} icon={<ShieldAlert className="h-4 w-4" />} tone="vermelho" />
        </div>

        <Card className="p-4 mb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor mensal contratado</p>
          <p className="text-2xl font-serif text-primary mt-1">
            {ind === null ? "…" : formatBRL(ind.valor_mensal_total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Soma dos contratos mensais ativos.</p>
        </Card>

        <Bloco titulo="Reajustes pendentes" icon={<TrendingUp className="h-4 w-4" />}>
          {reaj === null ? (
            <Loading />
          ) : reaj.length === 0 ? (
            <Vazio texto="Nenhum reajuste pendente na carteira." />
          ) : (
            <ul className="divide-y divide-[var(--landing-rule)]">
              {reaj.slice(0, 12).map((r) => (
                <li key={r.contrato_id} className="py-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{r.prestador_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.condominio_nome} · competência {formatDate(r.competencia)} · {rotuloIndiceContrato(r.indice_reajuste)} ·{" "}
                      {r.dias_ate_data_base < 0
                        ? `vencida há ${Math.abs(r.dias_ate_data_base)} dias`
                        : `em ${r.dias_ate_data_base} dias`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatBRL(r.valor_atual)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({
                          to: "/app/contratos/$contratoId",
                          params: { contratoId: r.contrato_id },
                          hash: "reajustes",
                        })
                      }
                    >
                      Revisar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Próximos 30 dias" icon={<CalendarClock className="h-4 w-4" />}>
          {eventos === null ? (
            <Loading />
          ) : eventos.length === 0 ? (
            <Vazio texto="Nenhum evento previsto nos próximos 30 dias." />
          ) : (
            <AgendaAgrupada rows={eventos} />
          )}
        </Bloco>

        <Bloco titulo="Pendências de checklist do mês" icon={<ClipboardList className="h-4 w-4" />}>
          {checklists === null ? (
            <Loading />
          ) : checklists.length === 0 ? (
            <Vazio texto="Todos os checklists do mês estão em dia." />
          ) : (
            <ul className="divide-y divide-[var(--landing-rule)]">
              {checklists.slice(0, 15).map((c) => (
                <li key={c.contrato_id} className="py-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{c.prestador_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.condominio_nome} · {c.tipos.map(traduzirTipoChecklist).join(", ")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({
                        to: "/app/contratos/$contratoId",
                        params: { contratoId: c.contrato_id },
                        hash: "checklists",
                      })
                    }
                  >
                    Abrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {ncs && ncs.length > 0 ? (
          <Bloco titulo="Não conformidades trabalhistas" icon={<ShieldAlert className="h-4 w-4 text-destructive" />}>
            <ul className="divide-y divide-[var(--landing-rule)]">
              {ncs.map((n, i) => (
                <li key={i} className="py-2">
                  <p className="text-sm font-medium">{n.prestador_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.condominio_nome} · {n.descricao}
                  </p>
                </li>
              ))}
            </ul>
          </Bloco>
        ) : null}

        <Bloco titulo="Distribuição por tipo de serviço" icon={<FileText className="h-4 w-4" />}>
          {ind === null ? (
            <Loading />
          ) : ind.distribuicao_tipos.length === 0 ? (
            <Vazio texto="Nenhum contrato ativo na carteira." />
          ) : (
            <DistribuicaoBarras rows={ind.distribuicao_tipos} />
          )}
        </Bloco>
      </div>
      </GestaoContratosGate>
    </AppShell>
  );
}

function Kpi({
  label, value, icon, tone, to,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone: "neutro" | "ambar" | "vermelho";
  to: string;
}) {
  const cls =
    tone === "vermelho"
      ? "border-destructive/40 text-destructive"
      : tone === "ambar"
        ? "border-augusto-gold/40 text-augusto-gold"
        : "border-border text-muted-foreground";
  return (
    <Link to={to as "/app/contratos"} className="block group">
      <Card className={`p-3 transition hover:shadow-sm ${cls}`}>
        <div className="flex items-center justify-between text-xs uppercase tracking-wide">
          <span>{label}</span>
          <span>{icon}</span>
        </div>
        <p className="text-2xl font-serif text-primary mt-1">
          {value === undefined ? "…" : value}
        </p>
      </Card>
    </Link>
  );
}

function Bloco({ titulo, icon, children }: { titulo: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-augusto-green">{icon}</span>
        <h2 className="text-lg font-serif text-primary">{titulo}</h2>
      </div>
      {children}
    </Card>
  );
}
function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
    </div>
  );
}
function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground">{texto}</p>;
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
    <div className="space-y-3">
      {grupos.slice(0, 10).map(([dia, itens]) => (
        <div key={dia}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{formatDate(dia)}</p>
          <ul className="space-y-1">
            {itens.map((it) => (
              <li key={it.id}>
                <Link
                  to="/app/contratos/$contratoId"
                  params={{ contratoId: it.contrato_id }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">{it.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {it.prestador_nome} · {it.condominio_nome}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground border border-border rounded px-1.5 py-0.5">
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
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.tipo_id ?? r.nome}>
          <div className="flex items-center justify-between text-sm mb-0.5">
            <span>{r.nome}</span>
            <span className="text-muted-foreground">{r.total}</span>
          </div>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-augusto-green/70"
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
function traduzirTipoChecklist(t: string): string {
  switch (t) {
    case "fiscalizacao": return "Fiscalização";
    case "pagamento": return "Pagamento";
    case "tributario": return "Tributário";
    case "trabalhista": return "Trabalhista";
    default: return t;
  }
}