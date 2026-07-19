import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Building, FileText, Briefcase, AlertTriangle, DollarSign, Check } from "lucide-react";
import { getDashboardImoveisMetrics, listAlertas, resolverAlerta, type AlertaItem } from "@/lib/imoveis/dashboard.functions";
import { formatBRL } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/")({
  component: Page,
});

function Page() {
  const metricsFn = useServerFn(getDashboardImoveisMetrics);
  const alertasFn = useServerFn(listAlertas);
  const resolverFn = useServerFn(resolverAlerta);
  const [m, setM] = useState<{ proprietarios: number; imoveis: number; contratosAtivos: number; pendenciasAbertas: number; honorariosAReceberMes: number } | null>(null);
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const reload = () => {
    metricsFn().then(setM).catch((e) => toast.error(e.message));
    alertasFn().then((r) => setAlertas(r.alertas)).catch((e) => toast.error(e.message));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Administração de Imóveis</h1>
        <p className="text-muted-foreground">
          Gestão de proprietários, imóveis e contratos de locação e administração.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>
        <ImoveisNav />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <MetricCard icon={<Users className="h-4 w-4" />} label="Proprietários" value={m?.proprietarios ?? "—"} />
          <MetricCard icon={<Building className="h-4 w-4" />} label="Imóveis" value={m?.imoveis ?? "—"} />
          <MetricCard icon={<FileText className="h-4 w-4" />} label="Contratos ativos" value={m?.contratosAtivos ?? "—"} />
          <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Pendências" value={m?.pendenciasAbertas ?? "—"} />
          <MetricCard icon={<DollarSign className="h-4 w-4" />} label="Honorários no mês" value={m ? formatBRL(m.honorariosAReceberMes) : "—"} />
        </div>

        <Card className="mb-6">
          <div className="p-4 flex items-center justify-between">
            <p className="font-medium text-primary">Coisas para checar ({alertas.length})</p>
          </div>
          <div className="divide-y">
            {alertas.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma pendência aberta 🎉</p>
            ) : alertas.map((a) => (
              <div key={a.chave} className="p-4 flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="uppercase text-[10px]">{a.tipo.replace(/_/g, " ")}</Badge>
                <div className="flex-1 min-w-[240px]">
                  <p className="font-medium text-sm">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground">{a.descricao}</p>
                  {a.mora && (
                    <p className="text-xs text-destructive mt-1">
                      Multa {formatBRL(a.mora.multa)} + Juros {formatBRL(a.mora.juros)} → Total {formatBRL(a.mora.total)}
                    </p>
                  )}
                </div>
                {a.contratoId && (a.tipo === "aluguel_vencido" || a.tipo === "encargo_vencido" || a.tipo === "contrato_terminando" || a.tipo === "reajuste_devido") && (
                  <Link to="/app/admin/imoveis/locacao/$id" params={{ id: a.contratoId }}>
                    <Button size="sm" variant="outline">Abrir painel</Button>
                  </Link>
                )}
                <Button size="sm" variant="ghost" onClick={async () => {
                  try { await resolverFn({ data: { chave: a.chave } }); toast.success("Alerta marcado"); reload(); }
                  catch (e) { toast.error((e as Error).message); }
                }}><Check className="h-4 w-4 mr-1" /> Checado</Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/app/admin/imoveis/proprietarios">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Proprietários</p>
                  <p className="text-sm text-muted-foreground">Cadastro dos donos dos imóveis.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/unidades">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Imóveis</p>
                  <p className="text-sm text-muted-foreground">Unidades vinculadas a cada proprietário.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/locacao">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Contratos de locação</p>
                  <p className="text-sm text-muted-foreground">Vínculo imóvel × inquilino, valores e caução.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/app/admin/imoveis/administracao">
            <Card className="p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">Contratos de administração</p>
                  <p className="text-sm text-muted-foreground">Honorários e regras entre administrador e proprietário.</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}<span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
    </Card>
  );
}