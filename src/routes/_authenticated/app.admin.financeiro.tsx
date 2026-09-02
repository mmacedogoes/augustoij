import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Wallet } from "lucide-react";

import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getFinanceiroResumo,
  listCustosClientes,
  listDespesas,
  createDespesa,
  deleteDespesa,
  listCancelamentos,
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
      <div className="max-w-6xl">
        <header className="app-page-header">
          <span className="app-eyebrow">Administração</span>
          <h1 className="app-title">Financeiro</h1>
          <p className="app-subtitle">Receita, custos, margem e despesas operacionais.</p>
        </header>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Tabs defaultValue="receita" className="mt-2">
          <TabsList>
            <TabsTrigger value="receita">Receita</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="margem">Margem</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="cancelamentos">Cancelamentos</TabsTrigger>
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
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 app-stagger">
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">MRR projetado</p>
        <p className="mt-2 text-2xl font-bold text-primary">{brl(r.mrr)}</p>
      </Card>
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Assinaturas ativas</p>
        <p className="mt-2 text-2xl font-bold text-primary">{r.assinaturas_ativas}</p>
      </Card>
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Ticket médio</p>
        <p className="mt-2 text-2xl font-bold text-primary">{brl(r.ticket_medio)}</p>
      </Card>
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Receita do mês</p>
        <p className="mt-2 text-2xl font-bold text-primary">{brl(r.mrr)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Estimativa baseada nas assinaturas ativas.</p>
      </Card>
    </div>
  );
}

function CustosTab() {
  const r = useResumo();
  const fn = useServerFn(listCustosClientes);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listCustosClientes>>>([]);
  useEffect(() => {
    fn({ data: undefined as never })
      .then((x) => setRows(x as typeof rows))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [fn]);
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4 app-stagger">
        <Card className="app-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Custo clientes (mês)</p>
          <p className="mt-2 text-2xl font-bold text-primary">{brl(r?.custos_clientes_mes ?? 0)}</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Despesas operacionais (mês)</p>
          <p className="mt-2 text-2xl font-bold text-primary">{brl(r?.despesas_mes ?? 0)}</p>
        </Card>
        <Card className="app-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Custo total</p>
          <p className="mt-2 text-2xl font-bold text-primary">{brl((r?.custos_clientes_mes ?? 0) + (r?.despesas_mes ?? 0))}</p>
        </Card>
      </div>
      <Card className="app-card divide-y divide-[var(--landing-rule)]">
        <div className="p-4 text-xs uppercase text-muted-foreground grid grid-cols-12 gap-2">
          <div className="col-span-5">Cliente</div>
          <div className="col-span-2 text-right">Mensagens</div>
          <div className="col-span-2 text-right">OpenAI</div>
          <div className="col-span-1 text-right">Embed</div>
          <div className="col-span-2 text-right">Storage</div>
        </div>
        {rows.length === 0 ? (
          <AppEmptyState icon={<Wallet />} title="Sem custos registrados neste mês" />
        ) : (
          rows.map((r) => (
            <div key={r.user_id} className="p-4 grid grid-cols-12 gap-2 items-center text-sm hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
              <div className="col-span-5">
                <p className="font-medium text-primary">{r.profile?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{r.profile?.email ?? r.user_id}</p>
              </div>
              <div className="col-span-2 text-right">{r.total_mensagens}</div>
              <div className="col-span-2 text-right">{brl(Number(r.custo_tokens_openai))}</div>
              <div className="col-span-1 text-right">{brl(Number(r.custo_embeddings))}</div>
              <div className="col-span-2 text-right">{brl(Number(r.custo_storage))}</div>
            </div>
          ))
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
  const margem = r.margem_mes;
  return (
    <div className="grid sm:grid-cols-3 gap-4 app-stagger">
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Receita</p>
        <p className="mt-2 text-2xl font-bold text-primary">{brl(r.mrr)}</p>
      </Card>
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Custo total</p>
        <p className="mt-2 text-2xl font-bold text-primary">{brl(r.custos_clientes_mes + r.despesas_mes)}</p>
      </Card>
      <Card className="app-card p-5">
        <p className="text-xs uppercase text-muted-foreground">Margem do mês</p>
        <p className={`mt-2 text-2xl font-bold ${margem >= 0 ? "text-augusto-green" : "text-red-500"}`}>
          {brl(margem)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {r.mrr > 0 ? `${((margem / r.mrr) * 100).toFixed(1)}% sobre receita` : "Sem receita"}
        </p>
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