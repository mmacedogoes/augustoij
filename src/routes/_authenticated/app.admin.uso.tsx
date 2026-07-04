import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getUsoOverview,
  listUsoPorUsuario,
  refreshCustosMes,
  listAlertas,
  getConfigAlertas,
  updateConfigAlertas,
} from "@/lib/admin-uso.functions";

export const Route = createFileRoute("/_authenticated/app/admin/uso")({
  component: UsoPage,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

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
  const [r, setR] = useState<Awaited<ReturnType<typeof getUsoOverview>> | null>(null);
  useEffect(() => {
    fn({ data: undefined as never }).then(setR).catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [fn]);
  if (!r) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Mensagens no mês" value={r.total_mensagens.toLocaleString("pt-BR")} />
        <Metric label="Tokens no mês" value={r.total_tokens.toLocaleString("pt-BR")} />
        <Metric label="Créditos Lovable" value={creditFmt.format(r.total_credits ?? 0)} />
        <Metric label="Custo IA (BRL)" value={brl(r.custo_ia_brl)} />
        <Metric label="Usuários ativos" value={String(r.usuarios_ativos)} />
        <Metric label="Storage total" value={`${r.storage_mb.toFixed(1)} MB`} />
        <Metric label="Documentos" value={`${r.documentos_total} (${r.documentos_erro} erros)`} />
        <Metric label="Base de conhecimento" value={`${r.kb_prontos}/${r.kb_total} prontos`} />
        <Metric label="Mês de referência" value={r.mes} />
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-primary mb-3">Mensagens por dia (últimos 30 dias)</h3>
        <div className="flex items-end gap-1 h-32">
          {(r.serie as { dia: string; mensagens: number }[]).map((d) => {
            const max = Math.max(1, ...(r.serie as { mensagens: number }[]).map((x) => x.mensagens));
            const h = (d.mensagens / max) * 100;
            return (
              <div key={d.dia} className="flex-1 flex flex-col items-center" title={`${d.dia}: ${d.mensagens}`}>
                <div className="w-full bg-primary/70 rounded-t" style={{ height: `${h}%` }} />
              </div>
            );
          })}
          {(!r.serie || r.serie.length === 0) && (
            <p className="text-xs text-muted-foreground">Sem dados no período.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-primary">{value}</p>
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
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listUsoPorUsuario>>>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    list({ data: undefined as never })
      .then((x) => setRows(x as typeof rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"))
      .finally(() => setLoading(false));
  }, [list]);
  useEffect(load, [load]);

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