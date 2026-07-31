import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { getAdminOverview } from "@/lib/admin.functions";

const AdminDashboardCharts = lazy(() => import("@/components/admin/AdminDashboardCharts"));

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

function AdminDashboardPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data: d } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

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

        {d ? (
          <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-[var(--app-radius)]" />}>
            <AdminDashboardCharts d={d} />
          </Suspense>
        ) : (
          <Skeleton className="h-[520px] w-full rounded-[var(--app-radius)]" />
        )}

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
    <Card className="app-card-interactive group p-5 transition-all duration-200 hover:border-border">
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
    <Card className="app-card p-4 transition-all duration-200 hover:border-border">
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


