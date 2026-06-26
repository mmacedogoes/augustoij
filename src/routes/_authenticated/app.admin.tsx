import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Users, Building2, MessagesSquare, Coins } from "lucide-react";
import { getAdminMetrics, getUsageTimeseries, isCurrentUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminDashboardPage,
  beforeLoad: async () => {
    try {
      const r = await isCurrentUserAdmin();
      if (!r?.admin) throw redirect({ to: "/app" });
    } catch {
      throw redirect({ to: "/app" });
    }
  },
});

type Metrics = {
  total_usuarios: number;
  total_admins: number;
  total_condominios: number;
  total_documentos: number;
  total_mensagens_mes: number;
  total_tokens_mes: number;
  custo_estimado_brl_mes: number;
  total_kb_documentos: number;
};

function AdminDashboardPage() {
  const fetchMetrics = useServerFn(getAdminMetrics);
  const fetchSeries = useServerFn(getUsageTimeseries);
  const [m, setM] = useState<Metrics | null>(null);
  const [series, setSeries] = useState<Array<{ dia: string; mensagens: number }>>([]);

  useEffect(() => {
    fetchMetrics().then((r) => setM(r as unknown as Metrics)).catch(() => {});
    fetchSeries({ data: { days: 30 } }).then((r) => setSeries(r as typeof series)).catch(() => {});
  }, [fetchMetrics, fetchSeries]);

  const maxVal = Math.max(1, ...series.map((s) => s.mensagens));

  const cards = [
    { label: "Usuários", value: m?.total_usuarios ?? 0, icon: Users },
    { label: "Condomínios", value: m?.total_condominios ?? 0, icon: Building2 },
    { label: "Mensagens (mês)", value: m?.total_mensagens_mes ?? 0, icon: MessagesSquare },
    {
      label: "Custo estimado (mês)",
      value: `R$ ${(m?.custo_estimado_brl_mes ?? 0).toFixed(2)}`,
      icon: Coins,
    },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Administração</h1>
        <p className="text-muted-foreground">
          Métricas do sistema, gestão de usuários e treinamento da IA.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className="h-4 w-4 text-accent" />
              </div>
              <p className="mt-2 text-2xl font-bold text-primary">{c.value}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-5">
          <p className="text-sm font-medium text-primary">Mensagens nos últimos 30 dias</p>
          <div className="mt-4 flex items-end gap-1 h-40">
            {series.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
            ) : (
              series.map((s) => (
                <div
                  key={s.dia}
                  className="flex-1 bg-accent/70 rounded-t"
                  style={{ height: `${(s.mensagens / maxVal) * 100}%` }}
                  title={`${s.dia}: ${s.mensagens} mensagens`}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <p className="text-sm font-medium text-primary">Base de conhecimento</p>
          <p className="mt-1 text-2xl font-bold text-primary">{m?.total_kb_documentos ?? 0}</p>
          <p className="text-xs text-muted-foreground">documentos jurídicos indexados</p>
        </Card>
      </div>
    </AppShell>
  );
}