import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  Wallet,
  Coins,
  Building2,
  FileWarning,
  Library,
  HardDrive,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminOverview, type AdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin/")({
  component: AdminDashboardPage,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n || 0);
const compactBrl = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toFixed(1)}k` : brl(n);
const fmtMes = (m: string) => {
  const [y, mm] = m.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mm) - 1] ?? mm}/${y.slice(-2)}`;
};
const fmtDia = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
};

function AdminDashboardPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const [d, setD] = useState<AdminOverview | null>(null);

  useEffect(() => {
    fetchOverview()
      .then((r) => setD(r as AdminOverview))
      .catch(() => {});
  }, [fetchOverview]);

  return (
    <AppShell>
      <div className="max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-primary tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do negócio · {d ? fmtMes(d.mes) : "carregando…"}
          </p>
        </header>
        <AdminNav />

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            label="MRR"
            value={d ? brl(d.mrr) : null}
            hint="Receita mensal recorrente"
            icon={Wallet}
            tone="primary"
          />
          <Kpi
            label="Assinaturas ativas"
            value={d ? d.assinaturas.ativas.toString() : null}
            hint={d ? `${d.assinaturas.trialing} em trial · ${d.assinaturas.cortesia} cortesia` : "—"}
            icon={Users}
          />
          <Kpi
            label="Novos usuários (mês)"
            value={d ? d.novos_usuarios_mes.toString() : null}
            hint="Cadastros neste mês"
            icon={UserPlus}
          />
          <Kpi
            label="Margem (mês)"
            value={d ? brl(d.margem_mes) : null}
            hint={
              d
                ? `Custo Lovable ${compactBrl(d.custo_lovable_mes)} · Despesas ${compactBrl(d.despesas_mes)}`
                : "—"
            }
            icon={d && d.margem_mes >= 0 ? TrendingUp : TrendingDown}
            tone={d && d.margem_mes < 0 ? "danger" : "accent"}
          />
        </section>

        <Card className="p-5 sm:p-6 border-border/60 rounded-2xl">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                Receita e custo · últimos 6 meses
              </p>
              <h3 className="mt-1 text-lg font-semibold text-primary">Fluxo mensal</h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <LegendDot className="bg-primary" label="Receita (MRR)" />
              <LegendDot className="bg-accent" label="Custo Lovable" />
            </div>
          </div>
          <div className="mt-4 h-64">
            {!d ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.serie_receita_custo} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="grad-custo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tickFormatter={fmtMes}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<TooltipCard mode="currency" labelFormatter={fmtMes} />}
                    cursor={{ stroke: "var(--color-border)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receita"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#grad-receita)"
                  />
                  <Area
                    type="monotone"
                    dataKey="custo"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="url(#grad-custo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="p-5 sm:p-6 border-border/60 rounded-2xl lg:col-span-2">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              Distribuição de assinaturas
            </p>
            <h3 className="mt-1 text-lg font-semibold text-primary">Por plano</h3>
            <div className="mt-4 h-56">
              {!d ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : d.distribuicao_planos.length === 0 ? (
                <EmptyState label="Sem assinaturas ainda." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.distribuicao_planos}
                      dataKey="quantidade"
                      nameKey="plano"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    >
                      {d.distribuicao_planos.map((_, i) => (
                        <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCard mode="number" />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {d && d.distribuicao_planos.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {d.distribuicao_planos.map((p, i) => (
                  <li key={p.plano} className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: `var(--color-chart-${(i % 5) + 1})` }}
                    />
                    <span className="truncate text-foreground">{p.plano}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">{p.quantidade}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6 border-border/60 rounded-2xl lg:col-span-3">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              Atividade
            </p>
            <h3 className="mt-1 text-lg font-semibold text-primary">Mensagens · últimos 30 dias</h3>
            <div className="mt-4 h-56">
              {!d ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : d.serie_mensagens.length === 0 ? (
                <EmptyState label="Sem mensagens no período." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.serie_mensagens} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
                      content={<TooltipCard mode="number" labelFormatter={fmtDia} />}
                      cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    />
                    <Bar dataKey="mensagens" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat
            icon={Building2}
            label="Condomínios"
            value={d ? String(d.operacional.condominios_total) : null}
            hint={d ? `${d.operacional.condominios_ativos_mes} ativos no mês` : "—"}
          />
          <MiniStat
            icon={FileWarning}
            label="Documentos"
            value={d ? String(d.operacional.documentos_total) : null}
            hint={
              d
                ? d.operacional.documentos_erro > 0
                  ? `${d.operacional.documentos_erro} com erro`
                  : "sem erros"
                : "—"
            }
            tone={d && d.operacional.documentos_erro > 0 ? "danger" : "muted"}
          />
          <MiniStat
            icon={Library}
            label="Base de conhecimento"
            value={d ? `${d.operacional.kb_prontos}/${d.operacional.kb_total}` : null}
            hint="documentos indexados"
          />
          <MiniStat
            icon={HardDrive}
            label="Storage"
            value={d ? `${d.operacional.storage_mb.toFixed(1)} MB` : null}
            hint="uso total"
          />
        </section>

        <p className="text-[11px] text-muted-foreground pt-2">
          <Coins className="inline h-3 w-3 mr-1" />
          Custo Lovable é atualizado automaticamente a cada mensagem. Despesas manuais em
          <span className="font-medium"> Admin → Financeiro</span>.
        </p>
      </div>
    </AppShell>
  );
}

/* ============================ Sub-componentes ============================ */

type Tone = "primary" | "accent" | "danger" | "muted";

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: string | null;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  const toneRing: Record<Tone, string> = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    accent: "bg-accent/15 text-accent ring-accent/20",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
    muted: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <Card className="group p-5 border-border/60 rounded-2xl transition-all duration-200 hover:border-border hover:shadow-sm">
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

function MiniStat({
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

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      <span>{label}</span>
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="h-full grid place-items-center text-xs text-muted-foreground">{label}</div>;
}

type TooltipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string };
function TooltipCard({
  active,
  payload,
  label,
  mode,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  mode: "currency" | "number";
  labelFormatter?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      {label !== undefined && (
        <p className="font-medium text-foreground mb-1">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      )}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name ?? p.dataKey}</span>
            <span className="ml-2 font-medium tabular-nums text-foreground">
              {mode === "currency"
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.value) || 0)
                : Number(p.value).toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
