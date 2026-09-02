import { useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminOverview } from "@/lib/admin.functions";
import { formatarMoeda } from "@/lib/formatters";

const fmtMes = (m: string) => {
  const [y, mm] = m.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mm) - 1] ?? mm}/${y.slice(-2)}`;
};
const fmtDia = (d: string) => {
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
};

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
                ? formatarMoeda(Number(p.value))
                : Number(p.value).toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </div>
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

export default function AdminDashboardCharts({ d }: { d: AdminOverview }) {
  const [pieMode, setPieMode] = useState<"quantidade" | "receita">("receita");

  const totalReceitaPlanos = d.distribuicao_planos.reduce((acc, p) => acc + (p.receita || 0), 0);
  const totalQtdePlanos = d.distribuicao_planos.reduce((acc, p) => acc + (p.quantidade || 0), 0);

  return (
    <>
      <Card className="app-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              Receita, custos de IA e margem operacional · últimos 6 meses
            </p>
            <h3 className="mt-1 text-lg font-semibold text-primary">Fluxo Financeiro Mensal</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <LegendDot className="bg-primary" label="Receita (MRR)" />
            <LegendDot className="bg-destructive" label="Custos (IA/Infra)" />
            <LegendDot className="bg-augusto-green" label="Margem Líquida" />
          </div>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.serie_receita_custo} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad-custo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad-lucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-augusto-green)" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="var(--color-augusto-green)" stopOpacity={0.02} />
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
              <Area type="monotone" name="Receita" dataKey="receita" stroke="var(--color-primary)" strokeWidth={2} fill="url(#grad-receita)" />
              <Area type="monotone" name="Custos" dataKey="custo" stroke="var(--color-destructive)" strokeWidth={1.75} fill="url(#grad-custo)" />
              <Area type="monotone" name="Margem Líquida" dataKey="lucro" stroke="var(--color-augusto-green)" strokeWidth={2} fill="url(#grad-lucro)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="app-card p-5 sm:p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                  Composição da Base
                </p>
                <h3 className="mt-1 text-lg font-semibold text-primary">Por Plano</h3>
              </div>
              <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5 text-xs">
                <Button
                  size="sm"
                  variant={pieMode === "receita" ? "default" : "ghost"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setPieMode("receita")}
                >
                  Receita
                </Button>
                <Button
                  size="sm"
                  variant={pieMode === "quantidade" ? "default" : "ghost"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setPieMode("quantidade")}
                >
                  Contas
                </Button>
              </div>
            </div>

            <div className="mt-4 h-52">
              {d.distribuicao_planos.length === 0 ? (
                <EmptyState label="Sem assinaturas cadastradas." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.distribuicao_planos}
                      dataKey={pieMode === "receita" ? "receita" : "quantidade"}
                      nameKey="plano"
                      innerRadius={46}
                      outerRadius={76}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    >
                      {d.distribuicao_planos.map((_, i) => (
                        <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCard mode={pieMode === "receita" ? "currency" : "number"} />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {d.distribuicao_planos.length > 0 && (
            <ul className="mt-3 divide-y divide-border/40 text-xs">
              {d.distribuicao_planos.map((p, i) => {
                const pct = pieMode === "receita"
                  ? totalReceitaPlanos > 0 ? ((p.receita / totalReceitaPlanos) * 100).toFixed(0) : "0"
                  : totalQtdePlanos > 0 ? ((p.quantidade / totalQtdePlanos) * 100).toFixed(0) : "0";

                return (
                  <li key={p.plano} className="py-1.5 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: `var(--color-chart-${(i % 5) + 1})` }}
                      />
                      <span className="truncate text-foreground font-medium">{p.plano}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-foreground">
                        {pieMode === "receita" ? formatarMoeda(p.receita) : `${p.quantidade} conta(s)`}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-1.5">({pct}%)</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="app-card p-5 sm:p-6 lg:col-span-3">
          <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Engajamento & Processamento IA</p>
          <h3 className="mt-1 text-lg font-semibold text-primary">Mensagens Jurídicas · últimos 30 dias</h3>
          <div className="mt-4 h-64">
            {d.serie_mensagens.length === 0 ? (
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
                  <Bar dataKey="mensagens" name="Mensagens IA" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>
    </>
  );
}