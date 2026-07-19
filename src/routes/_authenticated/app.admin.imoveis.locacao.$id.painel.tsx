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
import { Pencil, Check, X, ArrowLeft, TrendingUp, Wallet, FileText } from "lucide-react";
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
  getReajusteStatus,
} from "@/lib/imoveis/reajustes.functions";
import { formatBRL, formatDateBR, parseBRL } from "@/lib/imoveis/masks";
import { ManutencoesPanel } from "@/components/imoveis/ManutencoesPanel";
import { AlertTriangle } from "lucide-react";

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
  imovel_id: string;
  inquilino_nome: string | null;
  inquilino_telefone: string | null;
  valor_aluguel: number | null;
  valor_aluguel_inicial: number | null;
  dia_vencimento: number | null;
  data_inicio_vigencia: string | null;
  prazo_meses: number | null;
  indice_reajuste: string | null;
  periodicidade_reajuste_meses: number | null;
  status: string;
  multa_mora_percent: number;
  juros_mora_mensal_percent: number;
  imoveis: {
    descricao: string | null; endereco: string | null; edificio: string | null; numero_unidade: string | null;
    proprietarios: { nome: string } | null;
  } | null;
};

type Reajuste = {
  id: string; data: string; indice_usado: string; percentual: number;
  valor_anterior: number; valor_novo: number; observacoes: string | null;
};

type CaucaoRow = {
  possui: boolean; tipo: string | null; valor_depositado: number | null;
  data_deposito: string | null; corrige_com_rendimento: boolean;
  valor_atual_override: number | null; observacoes: string | null;
};

function Painel() {
  const { id } = Route.useParams();
  const listFn = useServerFn(listPagamentosContrato);
  const toggleFn = useServerFn(togglePagamento);
  const updateFn = useServerFn(updatePagamento);
  const calcularReajusteFn = useServerFn(calcularReajuste);
  const aplicarReajusteFn = useServerFn(aplicarReajuste);
  const listReajustesFn = useServerFn(listReajustes);
  const getCaucaoFn = useServerFn(getCaucaoAtualizada);
  const getReajusteStatusFn = useServerFn(getReajusteStatus);
  const [contrato, setContrato] = useState<ContratoInfo | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [editing, setEditing] = useState<{ id: string; valor: string; vencimento: string } | null>(null);
  const [reajustes, setReajustes] = useState<Reajuste[]>([]);
  const [reajusteStatus, setReajusteStatus] = useState<{
    proximaData: string | null; ultimoReajuste: string | null; diasParaReajuste: number | null; pendente: boolean;
  } | null>(null);
  const [caucao, setCaucao] = useState<{
    caucao: CaucaoRow | null; valorAtual: number; memoria: string | null; dataReferencia: string | null;
  } | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [reajusteForm, setReajusteForm] = useState<{
    loading: boolean; indice: string; percentual: string; valorAtualStr: string; valorNovoStr: string; observacoes: string; janela: string; erroApi: string | null;
  } | null>(null);

  const reload = () =>
    Promise.all([
      listFn({ data: { contratoId: id } }),
      listReajustesFn({ data: { contratoId: id } }),
      getCaucaoFn({ data: { contratoId: id } }),
      getReajusteStatusFn({ data: { contratoId: id } }),
    ])
      .then(([r, rj, cc, rs]) => {
        setContrato(r.contrato as unknown as ContratoInfo);
        setPagamentos((r.pagamentos ?? []) as unknown as Pagamento[]);
        setReajustes(rj.rows as unknown as Reajuste[]);
        setCaucao(cc as typeof caucao);
        setReajusteStatus(rs);
      })
      .catch((e) => toast.error(e.message));

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const abrirDialogoReajuste = async () => {
    setDlgOpen(true);
    setReajusteForm({ loading: true, indice: "", percentual: "", valorAtualStr: "", valorNovoStr: "", observacoes: "", janela: "", erroApi: null });
    try {
      const r = await calcularReajusteFn({ data: { contratoId: id } });
      const janela = `${String(r.janela.mesIni).padStart(2, "0")}/${r.janela.anoIni} a ${String(r.janela.mesFim).padStart(2, "0")}/${r.janela.anoFim}`;
      setReajusteForm({
        loading: false,
        indice: r.indiceUsado,
        percentual: r.acumulado.toFixed(4),
        valorAtualStr: r.valorAtual.toFixed(2),
        valorNovoStr: r.valorNovo.toFixed(2),
        observacoes: "",
        janela,
        erroApi: r.erroApi ?? null,
      });
    } catch (e) {
      toast.error((e as Error).message);
      setDlgOpen(false);
    }
  };

  const confirmarReajuste = async () => {
    if (!reajusteForm) return;
    const pct = Number(reajusteForm.percentual);
    const va = Number(reajusteForm.valorAtualStr);
    const vn = Number(reajusteForm.valorNovoStr);
    if (!Number.isFinite(pct) || !Number.isFinite(va) || !Number.isFinite(vn)) {
      toast.error("Valores inválidos"); return;
    }
    try {
      await aplicarReajusteFn({
        data: {
          contratoId: id,
          indiceUsado: reajusteForm.indice || "manual",
          percentual: pct,
          valorAnterior: va,
          valorNovo: vn,
          data: new Date().toISOString().slice(0, 10),
          observacoes: reajusteForm.observacoes || null,
        },
      });
      toast.success("Reajuste aplicado");
      setDlgOpen(false);
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

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
            <div><p className="text-xs text-muted-foreground">Aluguel inicial</p><p className="font-medium">{formatBRL(contrato?.valor_aluguel_inicial ?? contrato?.valor_aluguel)}</p></div>
            <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">dia {contrato?.dia_vencimento ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Início</p><p className="font-medium">{formatDateBR(contrato?.data_inicio_vigencia)}</p></div>
            <div><p className="text-xs text-muted-foreground">Fim</p><p className="font-medium">{formatDateBR(dataFim)}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/admin/imoveis/locacao/$id" params={{ id }}>
              <Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Editar contrato</Button>
            </Link>
            <Button size="sm" onClick={abrirDialogoReajuste}>
              <TrendingUp className="h-4 w-4 mr-1" /> Calcular reajuste
            </Button>
            <Link to="/app/admin/imoveis/locacao/$id/aditivo" params={{ id }}>
              <Button size="sm" variant="outline"><FileText className="h-4 w-4 mr-1" /> Gerar aditivo de renovação</Button>
            </Link>
          </div>
        </Card>

        {reajusteStatus?.pendente && (
          <Card className="p-5 mb-6 border-amber-500/50 bg-amber-500/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">Reajuste pendente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Próxima data de reajuste: <b>{formatDateBR(reajusteStatus.proximaData)}</b>
                  {reajusteStatus.diasParaReajuste != null && (
                    <> — {reajusteStatus.diasParaReajuste < 0
                      ? `${Math.abs(reajusteStatus.diasParaReajuste)} dia(s) em atraso`
                      : `em ${reajusteStatus.diasParaReajuste} dia(s)`}</>
                  )}
                  {contrato?.indice_reajuste && <> • índice {contrato.indice_reajuste}</>}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Calcule o novo valor com base no índice contratado e aplique para atualizar automaticamente o valor do aluguel.
                </p>
                <div className="mt-3">
                  <Button size="sm" onClick={abrirDialogoReajuste}>
                    <TrendingUp className="h-4 w-4 mr-1" /> Calcular e aplicar reajuste
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {caucao?.caucao?.possui && (
          <Card className="p-5 mb-6 border-primary/40">
            <div className="flex items-center gap-2 text-primary font-medium mb-2">
              <Wallet className="h-4 w-4" /> Caução
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{caucao.caucao.tipo ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Depositado</p><p className="font-medium">{formatBRL(caucao.caucao.valor_depositado)}</p></div>
              <div><p className="text-xs text-muted-foreground">Data depósito</p><p className="font-medium">{formatDateBR(caucao.caucao.data_deposito)}</p></div>
              <div><p className="text-xs text-muted-foreground">Corrige c/ rendimento</p><p className="font-medium">{caucao.caucao.corrige_com_rendimento ? "Sim" : "Não"}</p></div>
            </div>
            <div className="mt-4 p-4 rounded-md bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Valor a devolver ao inquilino hoje</p>
              <p className="text-2xl font-bold text-primary">{formatBRL(caucao.valorAtual)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Referência: {formatDateBR(caucao.dataReferencia)}
              </p>
              {caucao.memoria && (
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{caucao.memoria}</p>
              )}
            </div>
          </Card>
        )}

        {reajustes.length > 0 && (
          <Card className="p-5 mb-6">
            <div className="font-medium text-primary mb-3">Histórico de reajustes</div>
            <div className="divide-y">
              {reajustes.map((r) => (
                <div key={r.id} className="py-2 flex flex-wrap gap-3 text-sm">
                  <span className="min-w-[100px]">{formatDateBR(r.data)}</span>
                  <span className="min-w-[80px] uppercase text-xs text-muted-foreground">{r.indice_usado}</span>
                  <span className="min-w-[90px]">{Number(r.percentual).toFixed(4)}%</span>
                  <span>{formatBRL(r.valor_anterior)} → <b>{formatBRL(r.valor_novo)}</b></span>
                  {r.observacoes && <span className="text-muted-foreground italic">{r.observacoes}</span>}
                </div>
              ))}
            </div>
          </Card>
        )}

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

        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Calcular reajuste</DialogTitle></DialogHeader>
            {reajusteForm?.loading ? (
              <p className="text-sm text-muted-foreground">Consultando índices no Banco Central…</p>
            ) : reajusteForm ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Janela: {reajusteForm.janela}. Todos os campos são editáveis.
                </p>
                {reajusteForm.erroApi && (
                  <p className="text-xs text-destructive">API BCB: {reajusteForm.erroApi}. Ajuste manualmente.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Índice</Label>
                    <Input value={reajusteForm.indice} onChange={(e) => setReajusteForm({ ...reajusteForm, indice: e.target.value })} />
                  </div>
                  <div>
                    <Label>Acumulado (%)</Label>
                    <Input value={reajusteForm.percentual}
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const va = Number(reajusteForm.valorAtualStr);
                        const vn = Number.isFinite(pct) && Number.isFinite(va) ? (va * (1 + pct / 100)).toFixed(2) : reajusteForm.valorNovoStr;
                        setReajusteForm({ ...reajusteForm, percentual: e.target.value, valorNovoStr: vn });
                      }} />
                  </div>
                  <div>
                    <Label>Aluguel atual (R$)</Label>
                    <Input value={reajusteForm.valorAtualStr}
                      onChange={(e) => setReajusteForm({ ...reajusteForm, valorAtualStr: e.target.value })}
                      onBlur={(e) => { const p = parseBRL(e.target.value); if (p != null) setReajusteForm({ ...reajusteForm, valorAtualStr: p.toFixed(2) }); }} />
                  </div>
                  <div>
                    <Label>Novo aluguel (R$)</Label>
                    <Input value={reajusteForm.valorNovoStr}
                      onChange={(e) => setReajusteForm({ ...reajusteForm, valorNovoStr: e.target.value })}
                      onBlur={(e) => { const p = parseBRL(e.target.value); if (p != null) setReajusteForm({ ...reajusteForm, valorNovoStr: p.toFixed(2) }); }} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea rows={2} value={reajusteForm.observacoes} onChange={(e) => setReajusteForm({ ...reajusteForm, observacoes: e.target.value })} />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancelar</Button>
              <Button onClick={confirmarReajuste} disabled={!reajusteForm || reajusteForm.loading}>Aplicar reajuste</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}