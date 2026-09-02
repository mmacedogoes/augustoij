import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Users, TrendingUp, TrendingDown, Receipt, ArrowUpRight, ShieldCheck, Sparkles, Building2 } from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getFinanceiroResumo,
  listAssinaturasReceita,
  listCustosClientes,
  listDespesas,
  createDespesa,
  deleteDespesa,
  listCancelamentos,
  type AssinaturaReceitaRow,
} from "@/lib/admin-financeiro.functions";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { formatarMoeda } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/app/admin/financeiro")({
  component: FinanceiroPage,
});

const brl = (n: number) => formatarMoeda(n);

type Resumo = Awaited<ReturnType<typeof getFinanceiroResumo>>;

function FinanceiroPage() {
  return (
    <>
      <div className="max-w-6xl space-y-6">
        <header className="app-page-header">
          <span className="app-eyebrow">Administração Executiva</span>
          <h1 className="app-title">Financeiro & Unit Economics</h1>
          <p className="app-subtitle">Gestão de receita, ARR, custos de IA por cliente, rentabilidade e despesas operacionais.</p>
        </header>
        <AdminNav />

        <Tabs defaultValue="receita" className="mt-2">
          <TabsList>
            <TabsTrigger value="receita">Receita & Assinaturas</TabsTrigger>
            <TabsTrigger value="custos">Custos & Unit Economics</TabsTrigger>
            <TabsTrigger value="margem">DRE & Margem Líquida</TabsTrigger>
            <TabsTrigger value="despesas">Despesas Operacionais</TabsTrigger>
            <TabsTrigger value="cancelamentos">Cancelamentos & Churn</TabsTrigger>
          </TabsList>

          <TabsContent value="receita" className="mt-4">
            <ReceitaTab />
          </TabsContent>
          <TabsContent value="custos" className="mt-4">
            <CustosTab />
          </TabsContent>
          <TabsContent value="margem" className="mt-4">
            <MargemTab />
          </TabsContent>
          <TabsContent value="despesas" className="mt-4">
            <DespesasTab />
          </TabsContent>
          <TabsContent value="cancelamentos" className="mt-4">
            <CancelamentosTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function useResumo() {
  const fn = useServerFn(getFinanceiroResumo);
  const [data, setData] = useState<Resumo | null>(null);
  useEffect(() => {
    fn({ data: undefined as never })
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"));
  }, [fn]);
  return data;
}

function ReceitaTab() {
  const r = useResumo();
  const listSubsFn = useServerFn(listAssinaturasReceita);
  const [subs, setSubs] = useState<AssinaturaReceitaRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  useEffect(() => {
    listSubsFn({ data: undefined as never })
      .then((data) => {
        setSubs(data as AssinaturaReceitaRow[]);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar assinaturas"))
      .finally(() => setLoadingSubs(false));
  }, [listSubsFn]);

  if (!r)
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="app-card p-5 sm:p-6">
            <AppSkeletonLines lines={2} />
          </Card>
        ))}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 app-stagger">
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">MRR Real</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(r.mrr)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Receita mensal recorrente</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">ARR Projetado</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(r.arr)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Projeção anual (MRR × 12)</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Clientes Pagantes</p>
          <p className="mt-1 text-2xl font-bold text-primary">{r.assinaturas_ativas}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            +{r.assinaturas_cortesia} cortesia · +{r.assinaturas_vinculadas} equipe
          </p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Ticket Médio (ARPU)</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(r.ticket_medio)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Por cliente pagante</p>
        </Card>
      </div>

      {/* Tabela de Assinantes e Receita */}
      <Card className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground text-base">Carteira de Clientes & Assinaturas</h3>
            <p className="text-xs text-muted-foreground">
              Detalhamento de todos os titulares com plano ativo, valor, ciclo e status no Asaas.
            </p>
          </div>
          <Badge variant="outline" className="border-border">
            Total: {subs.length} contas
          </Badge>
        </div>

        {loadingSubs ? (
          <div className="p-5">
            <AppSkeletonLines lines={6} />
          </div>
        ) : subs.length === 0 ? (
          <AppEmptyState icon={<Receipt />} title="Nenhuma assinatura cadastrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4">Cliente / Razão Social</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4 text-right">Valor Mensal</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status / Asaas</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {subs.map((s) => (
                  <tr key={s.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">
                        {s.profile?.razao_social || s.profile?.nome || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.profile?.email}</p>
                      {s.vinculado_a_nome && (
                        <p className="text-[11px] text-primary mt-0.5">
                          ↳ Vinculado à conta de {s.vinculado_a_nome}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="capitalize text-xs font-medium">
                        {s.plano_nome} {s.ciclo === "anual" ? "(Anual)" : ""}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {s.cortesia || s.vinculado_a_id ? (
                        <span className="text-xs text-muted-foreground font-normal">
                          {s.cortesia ? "Cortesia (R$ 0)" : "Incluso na equipe"}
                        </span>
                      ) : (
                        brl(s.valor_mensal)
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {s.dia_vencimento ? `Todo dia ${s.dia_vencimento}` : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium ${
                          s.status === "active"
                            ? "bg-augusto-green/10 text-augusto-green"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {s.status === "active" ? "Ativo" : s.status}
                        </span>
                        {s.asaas_subscription_id && (
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30">
                            Asaas Sub
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-primary">
                        <Link to="/app/admin/usuarios/$userId" params={{ userId: s.user_id }}>
                          Ver detalhes <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CustosTab() {
  const r = useResumo();
  const fn = useServerFn(listCustosClientes);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listCustosClientes>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fn({ data: undefined as never })
      .then((x) => setRows(x as typeof rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar custos"))
      .finally(() => setLoading(false));
  }, [fn]);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4 app-stagger">
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Custo Total de IA (Mês)</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{brl(r?.custos_clientes_mes ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Modelos de IA, tokens e embeddings</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Despesas Operacionais</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(r?.despesas_mes ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Servidores e ferramentas</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Custo Total Consolidado</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {brl((r?.custos_clientes_mes ?? 0) + (r?.despesas_mes ?? 0))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Impacto direto na margem</p>
        </Card>
      </div>

      {/* Tabela de Unit Economics por Cliente */}
      <Card className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border">
          <h3 className="font-semibold text-foreground text-base">Unit Economics por Cliente</h3>
          <p className="text-xs text-muted-foreground">
            Margem de contribuição individual de cada cliente (Receita contratada (-) Custo de Consumo de IA).
          </p>
        </div>

        {loading ? (
          <div className="p-5">
            <AppSkeletonLines lines={6} />
          </div>
        ) : rows.length === 0 ? (
          <AppEmptyState icon={<Wallet />} title="Sem custos registrados neste mês" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4 text-right">Mensagens IA</th>
                  <th className="py-3 px-4 text-right">Receita (R$)</th>
                  <th className="py-3 px-4 text-right">Custo IA (R$)</th>
                  <th className="py-3 px-4 text-right">Margem Líquida</th>
                  <th className="py-3 px-4 text-center">Rentabilidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => {
                  const isHighMargin = row.margem_pct >= 70;
                  const isLowMargin = row.margem_brl < 0 || row.margem_pct < 30;

                  return (
                    <tr key={row.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-foreground">
                          {row.profile?.razao_social || row.profile?.nome || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.profile?.email ?? row.user_id}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs capitalize font-medium">
                          {row.plano_nome}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {row.total_mensagens.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground">
                        {brl(row.receita_mensal)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-destructive font-medium">
                        {brl(row.custo_ia_brl)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className={`font-semibold tabular-nums ${row.margem_brl >= 0 ? "text-augusto-green" : "text-destructive"}`}>
                          {brl(row.margem_brl)}
                        </p>
                        {row.receita_mensal > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {row.margem_pct}%
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.receita_mensal === 0 ? (
                          <Badge variant="outline" className="text-[11px] text-muted-foreground">
                            Cortesia / Free
                          </Badge>
                        ) : isHighMargin ? (
                          <Badge className="bg-augusto-green/10 text-augusto-green border-0 text-[11px]">
                            Alta Margem
                          </Badge>
                        ) : isLowMargin ? (
                          <Badge className="bg-destructive/10 text-destructive border-0 text-[11px]">
                            Alto Consumo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-500/30">
                            Moderada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MargemTab() {
  const r = useResumo();
  if (!r)
    return (
      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="app-card p-5 sm:p-6">
            <AppSkeletonLines lines={2} />
          </Card>
        ))}
      </div>
    );

  const margemContribuicao = r.mrr - r.custos_clientes_mes;
  const margemContribuicaoPct = r.mrr > 0 ? Number(((margemContribuicao / r.mrr) * 100).toFixed(1)) : 0;
  const margemLiquida = r.margem_mes;
  const margemLiquidaPct = r.margem_percentual;

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4 app-stagger">
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Receita Operacional (MRR)</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(r.mrr)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Base ativa recorrente</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Margem de Contribuição (IA)</p>
          <p className="mt-1 text-2xl font-bold text-primary">{brl(margemContribuicao)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{margemContribuicaoPct}% após custos diretos de IA</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase font-medium text-muted-foreground">Resultado Líquido Operacional</p>
          <p className={`mt-1 text-2xl font-bold ${margemLiquida >= 0 ? "text-augusto-green" : "text-destructive"}`}>
            {brl(margemLiquida)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {margemLiquidaPct}% de Margem Líquida
          </p>
        </Card>
      </div>

      {/* DRE Simplificado */}
      <Card className="app-card p-6">
        <h3 className="font-semibold text-foreground text-base mb-4">DRE Gerencial Simplificado (Mês Atual)</h3>
        <div className="divide-y divide-border/60 text-sm">
          <div className="py-3 flex items-center justify-between font-medium">
            <span className="text-foreground">(+) Receita Bruta Recorrente (MRR)</span>
            <span className="text-foreground font-semibold tabular-nums">{brl(r.mrr)}</span>
          </div>
          <div className="py-3 flex items-center justify-between text-muted-foreground pl-4">
            <span>(-) Custos Variáveis de IA e Embeddings</span>
            <span className="text-destructive tabular-nums font-medium">(-) {brl(r.custos_clientes_mes)}</span>
          </div>
          <div className="py-3 flex items-center justify-between font-medium bg-muted/20 px-2 rounded">
            <span className="text-foreground">(=) Margem de Contribuição Bruta</span>
            <span className="text-foreground font-semibold tabular-nums">
              {brl(margemContribuicao)} <span className="text-xs text-muted-foreground font-normal">({margemContribuicaoPct}%)</span>
            </span>
          </div>
          <div className="py-3 flex items-center justify-between text-muted-foreground pl-4">
            <span>(-) Despesas Fixas e Operacionais</span>
            <span className="text-destructive tabular-nums font-medium">(-) {brl(r.despesas_mes)}</span>
          </div>
          <div className="py-4 flex items-center justify-between font-bold text-base bg-primary/5 px-3 rounded-md border border-primary/20">
            <span className="text-primary">(=) Lucro / Margem Líquida Operacional</span>
            <span className={margemLiquida >= 0 ? "text-augusto-green" : "text-destructive"}>
              {brl(margemLiquida)} <span className="text-xs font-normal">({margemLiquidaPct}%)</span>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DespesasTab() {
  const list = useServerFn(listDespesas);
  const create = useServerFn(createDespesa);
  const remove = useServerFn(deleteDespesa);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listDespesas>>>([]);
  const [form, setForm] = useState({
    descricao: "",
    categoria: "infra",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    recorrente: false,
  });
  const refresh = useCallback(() => {
    list({ data: undefined as never })
      .then((x) => setRows(x as typeof rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [list]);
  useEffect(refresh, [refresh]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(form.valor.replace(",", "."));
    if (!form.descricao || !(valor > 0)) {
      toast.error("Preencha descrição e valor");
      return;
    }
    try {
      await create({
        data: {
          descricao: form.descricao,
          categoria: form.categoria,
          valor,
          data: form.data,
          recorrente: form.recorrente,
          periodicidade: "mensal",
        },
      });
      toast.success("Despesa registrada");
      setForm({ ...form, descricao: "", valor: "" });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="app-card p-5">
        <form onSubmit={add} className="grid md:grid-cols-6 gap-2 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} inputMode="decimal" required />
          </div>
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </form>
      </Card>
      <Card className="app-card divide-y divide-[var(--landing-rule)]">
        {rows.length === 0 ? (
          <AppEmptyState icon={<Wallet />} title="Nenhuma despesa registrada" />
        ) : (
          rows.map((d) => (
            <div key={d.id} className="p-4 flex items-center gap-3 text-sm hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
              <div className="flex-1">
                <p className="font-medium text-primary">{d.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {d.categoria} · {new Date(d.data).toLocaleDateString("pt-BR")}
                  {d.recorrente ? ` · recorrente (${d.periodicidade})` : ""}
                </p>
              </div>
              <span className="font-semibold text-primary">{brl(Number(d.valor))}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Excluir despesa?")) return;
                  try {
                    await remove({ data: { id: d.id } });
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Falha");
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function CancelamentosTab() {
  const fn = useServerFn(listCancelamentos);
  const [data, setData] = useState<Awaited<ReturnType<typeof listCancelamentos>> | null>(null);
  useEffect(() => {
    fn({ data: undefined as never })
      .then((x) => setData(x as typeof data))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [fn]);

  if (!data)
    return (
      <div className="space-y-4">
        <Card className="app-card p-5">
          <AppSkeletonLines lines={4} />
        </Card>
      </div>
    );

  return (
    <div className="space-y-4">
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground mb-3">Motivos declarados</p>
        {data.agregado.length === 0 ? (
          <AppEmptyState icon={<Wallet />} title="Nenhum cancelamento registrado" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 app-stagger">
            {data.agregado.map((a) => (
              <div key={a.motivo} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <span className="text-sm">{a.motivo}</span>
                <span className="text-sm font-semibold text-primary">{a.total}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="app-card divide-y divide-[var(--landing-rule)]">
        <div className="p-4 text-xs uppercase text-muted-foreground grid grid-cols-12 gap-2">
          <div className="col-span-4">Cliente</div>
          <div className="col-span-2">Plano</div>
          <div className="col-span-3">Motivo</div>
          <div className="col-span-3">Data</div>
        </div>
        {data.rows.length === 0 ? (
          <AppEmptyState icon={<Wallet />} title="Nenhum registro" />
        ) : (
          data.rows.map((c) => (
            <div key={c.id} className="p-4 grid grid-cols-12 gap-2 items-start text-sm hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
              <div className="col-span-4">
                <p className="font-medium text-primary">{c.profile?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{c.profile?.email ?? c.user_id}</p>
              </div>
              <div className="col-span-2 text-muted-foreground">{c.plano_config_id ?? "—"}</div>
              <div className="col-span-3">
                <p>{c.motivo}</p>
                {c.detalhes && <p className="text-xs text-muted-foreground mt-1">{c.detalhes}</p>}
              </div>
              <div className="col-span-3 text-muted-foreground">
                {new Date(c.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}