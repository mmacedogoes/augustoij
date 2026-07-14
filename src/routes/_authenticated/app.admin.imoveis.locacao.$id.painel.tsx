import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, ArrowLeft, TrendingUp, Wallet } from "lucide-react";
import {
  listPagamentosContrato,
  togglePagamento,
  updatePagamento,
  calcularMora,
} from "@/lib/imoveis/pagamentos.functions";
import {
  calcularReajuste,
  aplicarReajuste,
  listReajustes,
  getCaucaoAtualizada,
} from "@/lib/imoveis/reajustes.functions";
import { formatBRL, formatDateBR, parseBRL } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/locacao/$id/painel")({
  component: Painel,
});

type Pagamento = {
  id: string;
  tipo: string;
  competencia: string;
  valor: number | null;
  vencimento: string;
  pago: boolean;
  data_pagamento: string | null;
  observacoes: string | null;
};

type ContratoInfo = {
  id: string;
  inquilino_nome: string | null;
  valor_aluguel: number | null;
  dia_vencimento: number | null;
  data_inicio_vigencia: string | null;
  prazo_meses: number | null;
  status: string;
  multa_mora_percent: number;
  juros_mora_mensal_percent: number;
  imoveis: {
    descricao: string | null; endereco: string | null; edificio: string | null; numero_unidade: string | null;
    proprietarios: { nome: string } | null;
  } | null;
};

function Painel() {
  const { id } = Route.useParams();
  const listFn = useServerFn(listPagamentosContrato);
  const toggleFn = useServerFn(togglePagamento);
  const updateFn = useServerFn(updatePagamento);
  const [contrato, setContrato] = useState<ContratoInfo | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [editing, setEditing] = useState<{ id: string; valor: string; vencimento: string } | null>(null);

  const reload = () =>
    listFn({ data: { contratoId: id } })
      .then((r) => {
        setContrato(r.contrato as unknown as ContratoInfo);
        setPagamentos((r.pagamentos ?? []) as unknown as Pagamento[]);
      })
      .catch((e) => toast.error(e.message));

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const hoje = new Date();
  const im = contrato?.imoveis;
  const dataFim = contrato?.data_inicio_vigencia && contrato?.prazo_meses
    ? (() => { const d = new Date(contrato.data_inicio_vigencia + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + (contrato.prazo_meses as number)); return d.toISOString().slice(0, 10); })()
    : null;

  return (
    <AppShell>
      <div className="max-w-6xl">
        <div className="flex items-center gap-3">
          <Link to="/app/admin/imoveis/locacao"><Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
          <h1 className="text-3xl font-bold text-primary">Painel da locação</h1>
        </div>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />

        <Card className="p-5 mb-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Inquilino</p><p className="font-medium">{contrato?.inquilino_nome ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Imóvel</p><p className="font-medium">{im ? `${im.descricao || im.edificio || im.endereco || ""}${im.numero_unidade ? ` — un. ${im.numero_unidade}` : ""}` : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Proprietário</p><p className="font-medium">{im?.proprietarios?.nome ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><Badge>{contrato?.status}</Badge></div>
            <div><p className="text-xs text-muted-foreground">Aluguel</p><p className="font-medium">{formatBRL(contrato?.valor_aluguel)}</p></div>
            <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">dia {contrato?.dia_vencimento ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Início</p><p className="font-medium">{formatDateBR(contrato?.data_inicio_vigencia)}</p></div>
            <div><p className="text-xs text-muted-foreground">Fim</p><p className="font-medium">{formatDateBR(dataFim)}</p></div>
          </div>
          <div className="mt-4">
            <Link to="/app/admin/imoveis/locacao/$id" params={{ id }}>
              <Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Editar contrato</Button>
            </Link>
          </div>
        </Card>

        <Card className="divide-y">
          <div className="p-4 font-medium text-primary">Parcelas ({pagamentos.length})</div>
          {pagamentos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem parcelas geradas. Verifique se o contrato tem data de início e dia de vencimento.</p>
          ) : pagamentos.map((p) => {
            const isEditing = editing?.id === p.id;
            const vencida = !p.pago && new Date(p.vencimento) < hoje;
            const mora = vencida
              ? calcularMora(Number(p.valor ?? 0), p.vencimento, hoje, contrato?.multa_mora_percent ?? 2, contrato?.juros_mora_mensal_percent ?? 1)
              : null;
            return (
              <div key={p.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-[80px]">
                  <span className="text-xs uppercase font-medium tracking-wide text-muted-foreground">{p.tipo}</span>
                </div>
                <div className="min-w-[110px]"><p className="text-sm">{p.competencia}</p></div>
                <div className="min-w-[130px]">
                  {isEditing ? (
                    <Input value={editing.vencimento} onChange={(e) => setEditing({ ...editing, vencimento: e.target.value })} type="date" />
                  ) : (
                    <p className="text-sm">Venc: {formatDateBR(p.vencimento)}</p>
                  )}
                </div>
                <div className="min-w-[130px]">
                  {isEditing ? (
                    <Input value={editing.valor} onChange={(e) => setEditing({ ...editing, valor: e.target.value })} placeholder="R$ 0,00" />
                  ) : (
                    <p className="text-sm font-medium">{formatBRL(p.valor)}</p>
                  )}
                </div>
                <div className="flex-1 min-w-[180px]">
                  {p.pago ? (
                    <Badge variant="secondary">Pago em {formatDateBR(p.data_pagamento)}</Badge>
                  ) : vencida ? (
                    <span className="text-xs text-destructive">
                      Atraso {mora?.diasAtraso}d • Multa {formatBRL(mora?.multa)} • Juros {formatBRL(mora?.juros)} → Total {formatBRL(mora?.total)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Em aberto</span>
                  )}
                </div>
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={async () => {
                      try {
                        await updateFn({ data: { id: p.id, valor: parseBRL(editing.valor), vencimento: editing.vencimento || null } });
                        setEditing(null); toast.success("Parcela atualizada"); reload();
                      } catch (e) { toast.error((e as Error).message); }
                    }}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant={p.pago ? "outline" : "default"} onClick={async () => {
                      try {
                        await toggleFn({ data: { id: p.id, pago: !p.pago } });
                        toast.success(p.pago ? "Marcado como não pago" : "Marcado como pago");
                        reload();
                      } catch (e) { toast.error((e as Error).message); }
                    }}>{p.pago ? "Desfazer" : "Marcar como pago"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, valor: p.valor?.toString() ?? "", vencimento: p.vencimento })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </AppShell>
  );
}