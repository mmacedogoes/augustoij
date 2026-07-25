import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw,
  MessagesSquare,
  Cpu,
  Coins,
  Users,
  HardDrive,
  FileText,
  Library,
  ChevronRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getUsoOverview,
  listUsoPorUsuario,
  refreshCustosMes,
  listAlertas,
  getConfigAlertas,
  updateConfigAlertas,
  getConsumoPorOrigemMes,
} from "@/lib/admin-uso.functions";

export const Route = createFileRoute("/_authenticated/app/admin/uso")({
  component: UsoPage,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const compact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
};
const fmtDia = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
};

function UsoPage() {
  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Uso & Custos</h1>
        <p className="text-muted-foreground">
          Consumo de mensagens, storage e desempenho por usuário. Configure alertas de uso.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>
        <Tabs defaultValue="overview" className="mt-2">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="usuarios">Custos por usuário</TabsTrigger>
            <TabsTrigger value="alertas">Alertas & limites</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="usuarios" className="mt-4"><UsuariosTab /></TabsContent>
          <TabsContent value="alertas" className="mt-4"><AlertasTab /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function OverviewTab() {
  const fn = useServerFn(getUsoOverview);
  const {
    data: r = null,
    isFetching: refreshing,
    refetch,
  } = useQuery({
    queryKey: ["admin-uso-overview"],
    queryFn: () => fn({ data: undefined as never }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const load = useCallback(() => {
    refetch().catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [refetch]);

  const serie = (r?.serie ?? []) as Array<{ dia: string; mensagens: number }>;
  const top = r?.top_usuarios ?? [];
  const topMax = useMemo(() => Math.max(1, ...top.map((t) => t.custo_brl)), [top]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Métricas do mês corrente. Custo Lovable é atualizado automaticamente a cada mensagem.
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Recarregar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          icon={MessagesSquare}
          label="Mensagens no mês"
          value={r ? r.total_mensagens.toLocaleString("pt-BR") : null}
          hint={r ? `${r.usuarios_ativos} usuários ativos` : "—"}
          tone="primary"
        />
        <Metric
          icon={Cpu}
          label="Média tokens/msg"
          value={r ? compact(r.media_tokens_msg) : null}
          hint={r ? `Total: ${compact(r.total_tokens)} · input + output` : "—"}
          title={
            r
              ? `${r.total_tokens.toLocaleString("pt-BR")} tokens processados no mês (soma de prompt + completion de todas as chamadas)`
              : undefined
          }
        />
        <Metric
          icon={Coins}
          label="Custo médio/msg"
          value={r ? brl(r.custo_medio_msg) : null}
          hint={r ? `Total Lovable: ${brl(r.custo_ia_brl)}` : "—"}
          tone="accent"
        />
        <Metric
          icon={Users}
          label="Usuários ativos"
          value={r ? r.usuarios_ativos.toString() : null}
          hint={r ? `${creditFmt.format(r.total_credits ?? 0)} créditos consumidos` : "—"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-5 sm:p-6 border-border/60 rounded-2xl lg:col-span-3">
          <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Atividade</p>
          <h3 className="mt-1 text-lg font-semibold text-primary">Mensagens por dia · 30 dias</h3>
          <div className="mt-4 h-56">
            {!r ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : serie.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-muted-foreground">
                Sem dados no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="grad-msg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={fmtDia}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
                          <p className="font-medium text-foreground mb-1">{fmtDia(String(label))}</p>
                          <p className="text-muted-foreground">
                            <span className="font-medium tabular-nums text-foreground">
                              {Number(payload[0].value).toLocaleString("pt-BR")}
                            </span>{" "}
                            mensagens
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="mensagens"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="url(#grad-msg)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 border-border/60 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                Top 5 · custo do mês
              </p>
              <h3 className="mt-1 text-lg font-semibold text-primary">Maiores consumos</h3>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {!r ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
            ) : top.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sem consumo registrado.</p>
            ) : (
              top.map((u) => (
                <Link
                  key={u.user_id}
                  to="/app/admin/usuarios/$userId"
                  params={{ userId: u.user_id }}
                  className="group block rounded-lg border border-transparent px-2.5 py-2 transition-all duration-200 hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <p className="font-medium text-foreground truncate flex-1 min-w-0">{u.nome}</p>
                    <p className="font-semibold text-primary tabular-nums shrink-0">{brl(u.custo_brl)}</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.max(4, (u.custo_brl / topMax) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {u.mensagens.toLocaleString("pt-BR")} mensagens
                  </p>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Operacional */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniCard
          icon={HardDrive}
          label="Storage total"
          value={r ? `${r.storage_mb.toFixed(1)} MB` : null}
          hint="uso em documentos"
        />
        <MiniCard
          icon={FileText}
          label="Documentos"
          value={r ? String(r.documentos_total) : null}
          hint={r ? (r.documentos_erro > 0 ? `${r.documentos_erro} com erro` : "sem erros") : "—"}
          tone={r && r.documentos_erro > 0 ? "danger" : "muted"}
        />
        <MiniCard
          icon={Library}
          label="Base de conhecimento"
          value={r ? `${r.kb_prontos}/${r.kb_total}` : null}
          hint="documentos prontos"
        />
      </div>

      <ConsumoPorOrigem />
    </div>
  );
}

const ORIGEM_LABEL: Record<string, string> = {
  chat: "Chat com usuários",
  importacao_convencao: "Importação de convenção (IA)",
  ocr_visao_documento: "OCR/Visão de documentos",
  ocr_visao_kb: "OCR/Visão da base de conhecimento",
  embedding_documento: "Indexação (embeddings) de documentos",
  embedding_kb: "Indexação (embeddings) da base de conhecimento",
  demo_chat: "Chat de demonstração (landing)",
  outro: "Outros",
};

function ConsumoPorOrigem() {
  const fn = useServerFn(getConsumoPorOrigemMes);
  const { data = null } = useQuery({
    queryKey: ["admin-uso-origem"],
    queryFn: () => fn({ data: undefined as never }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const linhas = data?.linhas ?? [];
  const maxCred = useMemo(() => Math.max(1, ...linhas.map((l) => l.credits)), [linhas]);
  return (
    <Card className="p-5 sm:p-6 border-border/60 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Onde os créditos foram usados
          </p>
          <h3 className="mt-1 text-lg font-semibold text-primary">Consumo Lovable por origem · mês</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Além do chat, importação de convenção, OCR e embeddings de documentos também consomem créditos.
          </p>
        </div>
        <p className="text-sm font-semibold text-primary tabular-nums shrink-0">
          {data ? brl(data.total_brl) : "—"}
        </p>
      </div>
      <div className="mt-4 space-y-2.5">
        {!data ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
        ) : linhas.filter((l) => l.credits > 0).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sem consumo registrado neste mês.
          </p>
        ) : (
          linhas
            .filter((l) => l.credits > 0)
            .map((l) => (
              <div key={l.origem} className="rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <p className="font-medium text-foreground truncate flex-1 min-w-0">
                    {ORIGEM_LABEL[l.origem] ?? l.origem}
                  </p>
                  <p className="font-semibold text-primary tabular-nums shrink-0">{brl(l.brl)}</p>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.max(4, (l.credits / maxCred) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  {creditFmt.format(l.credits)} créditos
                  {l.count > 0 ? ` · ${l.count} chamada(s)` : ""}
                  {l.tokens > 0 ? ` · ${compact(l.tokens)} tokens` : ""}
                </p>
              </div>
            ))
        )}
      </div>
    </Card>
  );
}

type Tone = "primary" | "accent" | "danger" | "muted";

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "muted",
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  hint: string;
  tone?: Tone;
  title?: string;
}) {
  const toneRing: Record<Tone, string> = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    accent: "bg-accent/15 text-accent ring-accent/20",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    muted: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <Card
      title={title}
      className="p-5 border-border/60 rounded-2xl transition-all duration-200 hover:border-border hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
        <span
          className={`grid place-items-center h-8 w-8 rounded-lg ring-1 transition-colors ${toneRing[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2.5 text-[28px] leading-none font-semibold text-primary tabular-nums">{value}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground truncate">{hint}</p>
    </Card>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  hint: string;
  tone?: Tone;
}) {
  const iconColor =
    tone === "danger" ? "text-destructive" : tone === "accent" ? "text-accent" : "text-muted-foreground";
  return (
    <Card className="p-4 border-border/60 rounded-xl transition-all duration-200 hover:border-border">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <p className="mt-1.5 text-xl font-semibold text-primary tabular-nums">{value}</p>
      )}
      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</p>
    </Card>
  );
}

function pctColor(pct: number | null) {
  if (pct == null) return "bg-muted-foreground/30";
  if (pct >= 100) return "bg-destructive";
  if (pct >= 80) return "bg-accent";
  if (pct >= 50) return "bg-accent/70";
  return "bg-primary";
}

const creditFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function UsuariosTab() {
  const list = useServerFn(listUsoPorUsuario);
  const refresh = useServerFn(refreshCustosMes);
  const {
    data: rows = [],
    isFetching: loading,
    refetch,
  } = useQuery({
    queryKey: ["admin-uso-usuarios"],
    queryFn: () => list({ data: undefined as never }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const load = useCallback(() => {
    refetch().catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Créditos calculados a partir dos tokens reais × preço do modelo
          (tabela <code className="font-mono">model_pricing</code>).
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={async () => {
            try {
              await refresh({ data: undefined as never });
              toast.success("Custos recalculados");
              load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha");
            }
          }}
          className="transition-colors duration-200"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Recalcular mês
        </Button>
      </div>
      <Card className="overflow-hidden border-border/70">
        <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/60">
          <div className="col-span-3">Usuário</div>
          <div className="col-span-3">Mensagens</div>
          <div className="col-span-3">Storage</div>
          <div className="col-span-1 text-right">Créditos</div>
          <div className="col-span-2 text-right">Custo total</div>
        </div>
        <div className="divide-y divide-border/60">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {loading ? "Carregando…" : "Sem dados no período."}
            </p>
          ) : (
            rows.map((r) => (
              <div
                key={r.user_id}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 items-center text-sm transition-colors duration-150 hover:bg-muted/30 focus-within:bg-muted/40"
              >
                <div className="md:col-span-3 min-w-0">
                  <p className="font-medium text-foreground truncate leading-tight">
                    {r.nome ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.email}</p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {r.plano_nome}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{r.status}</span>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm tabular-nums text-foreground font-medium">
                      {r.mensagens.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {r.limite_mensagens ? `de ${r.limite_mensagens.toLocaleString("pt-BR")}` : "sem limite"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ease-out ${pctColor(r.pct_mensagens)}`}
                      style={{ width: `${Math.min(100, r.pct_mensagens ?? 0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {brl(r.custo_ia_brl)} <span className="opacity-60">IA</span>
                  </p>
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm tabular-nums text-foreground font-medium">
                      {r.storage_mb.toFixed(1)} MB
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {r.limite_storage_mb ? `de ${r.limite_storage_mb} MB` : "sem limite"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ease-out ${pctColor(r.pct_storage)}`}
                      style={{ width: `${Math.min(100, r.pct_storage ?? 0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {brl(r.custo_storage_brl)} <span className="opacity-60">storage</span>
                  </p>
                </div>

                <div className="md:col-span-1 flex md:block items-baseline justify-between md:text-right">
                  <span className="md:hidden text-[11px] uppercase tracking-wider text-muted-foreground">
                    Créditos
                  </span>
                  <div className="md:text-right">
                    <p
                      className="text-base font-semibold text-primary bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 inline-block tabular-nums"
                      title={r.creditos_fonte === "real" ? "Créditos reais" : "Estimado (sem tokens registrados)"}
                    >
                      {creditFmt.format(r.creditos_lovable)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block">
                      Lovable {r.creditos_fonte === "estimado" ? "(est.)" : ""}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2 flex md:block items-baseline justify-between md:text-right border-t md:border-t-0 border-border/40 pt-2 md:pt-0">
                  <span className="md:hidden text-[11px] uppercase tracking-wider text-muted-foreground">
                    Custo total
                  </span>
                  <p className="text-base font-semibold text-primary tabular-nums leading-tight">
                    {brl(r.custo_total_brl)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function AlertasTab() {
  const cfgFn = useServerFn(getConfigAlertas);
  const updFn = useServerFn(updateConfigAlertas);
  const listFn = useServerFn(listAlertas);
  const [cfg, setCfg] = useState<{
    thresholds: number[];
    notificar_admin: boolean;
    notificar_usuarios: boolean;
    custo_storage_mb_brl: number;
    credito_brl: number;
  } | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listAlertas>>>([]);
  const [thresholdsStr, setThresholdsStr] = useState("50,80,100");

  useEffect(() => {
    cfgFn({ data: undefined as never }).then((c) => {
      const parsed = {
        thresholds: (c.thresholds ?? [50, 80, 100]) as number[],
        notificar_admin: c.notificar_admin ?? true,
        notificar_usuarios: c.notificar_usuarios ?? false,
        custo_storage_mb_brl: Number(c.custo_storage_mb_brl ?? 0.0001),
        credito_brl: Number((c as { credito_brl?: number }).credito_brl ?? 0.05),
      };
      setCfg(parsed);
      setThresholdsStr(parsed.thresholds.join(","));
    });
    listFn({ data: undefined as never }).then((x) => setRows(x as typeof rows)).catch(() => {});
  }, [cfgFn, listFn]);

  if (!cfg) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const salvar = async () => {
    const thr = thresholdsStr.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (thr.length === 0) return toast.error("Informe pelo menos um threshold");
    try {
      await updFn({
        data: {
          thresholds: thr,
          notificar_admin: cfg.notificar_admin,
          notificar_usuarios: cfg.notificar_usuarios,
          custo_storage_mb_brl: cfg.custo_storage_mb_brl,
          credito_brl: cfg.credito_brl,
        },
      });
      toast.success("Configuração salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-primary">Configuração de alertas</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Thresholds (% consumo)</Label>
            <Input value={thresholdsStr} onChange={(e) => setThresholdsStr(e.target.value)} placeholder="50,80,100" />
            <p className="text-[11px] text-muted-foreground mt-1">Percentuais separados por vírgula.</p>
          </div>
          <div>
            <Label className="text-xs">Custo storage (R$/MB/mês)</Label>
            <Input
              type="number"
              step="0.000001"
              value={cfg.custo_storage_mb_brl}
              onChange={(e) => setCfg({ ...cfg, custo_storage_mb_brl: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">R$ por crédito Lovable</Label>
            <Input
              type="number"
              step="0.0001"
              value={cfg.credito_brl}
              onChange={(e) => setCfg({ ...cfg, credito_brl: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Câmbio usado para converter créditos em BRL. Preços por token vivem
              na tabela <code className="font-mono">model_pricing</code>.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium">Notificar admin</p>
            <p className="text-xs text-muted-foreground">Você recebe cada alerta disparado.</p>
          </div>
          <Switch checked={cfg.notificar_admin} onCheckedChange={(v) => setCfg({ ...cfg, notificar_admin: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Notificar usuários</p>
            <p className="text-xs text-muted-foreground">
              Deixe desligado enquanto os usuários estão em trial.
            </p>
          </div>
          <Switch checked={cfg.notificar_usuarios} onCheckedChange={(v) => setCfg({ ...cfg, notificar_usuarios: v })} />
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar}>Salvar configuração</Button>
        </div>
      </Card>

      <Card className="divide-y">
        <div className="p-3 text-xs uppercase text-muted-foreground">Alertas disparados neste mês</div>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum alerta no período.</p>
        ) : (
          rows.map((a) => (
            <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="font-medium text-primary">{a.profile?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{a.profile?.email ?? a.user_id}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-muted">{a.tipo}</span>
              <span
                className={`text-xs px-2 py-1 rounded text-white ${pctColor(a.threshold_pct)}`}
              >
                {a.threshold_pct}%
              </span>
              <span className="text-xs text-muted-foreground w-32 text-right">
                {new Date(a.disparado_em).toLocaleString("pt-BR")}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}