import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Check, FileText, MessageCircle, Calculator } from "lucide-react";
import {
  gerarHonorariosMensais, listHonorarios, marcarHonorarioRecebido,
  calcularMoraHonorario, getHonorarioDetalhes,
} from "@/lib/imoveis/honorarios.functions";
import { listProprietarios } from "@/lib/imoveis/proprietarios.functions";
import { formatBRL, formatDateBR, onlyDigits } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/honorarios/")({
  component: Page,
});

type Row = {
  id: string;
  tipo: string;
  competencia: string;
  base_calculo: number | null;
  percentual: number | null;
  valor: number | null;
  vencimento: string | null;
  pago: boolean;
  data_pagamento: string | null;
  contratos_administracao: {
    proprietario_id: string | null;
    proprietarios: { id: string; nome: string; telefone: string | null; pix: string | null } | null;
  } | null;
  contratos_locacao: {
    imoveis: { descricao: string | null; edificio: string | null; numero_unidade: string | null; endereco: string | null } | null;
  } | null;
};

function imovelLabel(r: Row): string {
  const im = r.contratos_locacao?.imoveis;
  if (!im) return "—";
  return `${im.descricao || im.edificio || im.endereco || "Imóvel"}${im.numero_unidade ? ` — un. ${im.numero_unidade}` : ""}`;
}

function competenciaLabel(c: string): string {
  const [y, m] = c.split("-");
  if (!y || !m) return c;
  return `${m}/${y}`;
}

function Page() {
  const gerarFn = useServerFn(gerarHonorariosMensais);
  const listFn = useServerFn(listHonorarios);
  const marcarFn = useServerFn(marcarHonorarioRecebido);
  const listPropFn = useServerFn(listProprietarios);

  const [rows, setRows] = useState<Row[]>([]);
  const [proprietarios, setProprietarios] = useState<Array<{ id: string; nome: string }>>([]);
  const [propriedade, setPropriedade] = useState<string>("todos");
  const [status, setStatus] = useState<"todos" | "a_receber" | "recebido" | "atrasado">("todos");
  const [competencia, setCompetencia] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [dialog, setDialog] = useState<
    { mode: "recibo" | "cobranca"; row: Row } | null
  >(null);

  const reload = async () => {
    try {
      const r = await listFn({
        data: {
          proprietarioId: propriedade === "todos" ? undefined : propriedade,
          competencia: competencia || undefined,
          status,
        },
      });
      setRows(r.rows as unknown as Row[]);
    } catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => {
    listPropFn().then((r) => setProprietarios(r.rows as Array<{ id: string; nome: string }>)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [propriedade, status, competencia]);

  const totais = useMemo(() => {
    const soma = (pred: (r: Row) => boolean) =>
      rows.filter(pred).reduce((acc, r) => acc + Number(r.valor ?? 0), 0);
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      receber: soma((r) => !r.pago),
      recebido: soma((r) => r.pago),
      atrasado: soma((r) => !r.pago && !!r.vencimento && r.vencimento < hoje),
    };
  }, [rows]);

  const gerar = async () => {
    setBusy(true);
    try {
      const r = await gerarFn({
        data: { proprietarioId: propriedade === "todos" ? undefined : propriedade },
      });
      toast.success(`Honorários lançados: ${r.criados}`);
      await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Honorários</h1>
        <p className="text-muted-foreground">Lançamentos mensais e de renovação; recibos e cobranças.</p>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">A receber</p>
            <p className="text-2xl font-semibold">{formatBRL(totais.receber)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-2xl font-semibold">{formatBRL(totais.recebido)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Atrasado</p>
            <p className="text-2xl font-semibold text-destructive">{formatBRL(totais.atrasado)}</p>
          </Card>
        </div>

        <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Proprietário</Label>
            <Select value={propriedade} onValueChange={setPropriedade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {proprietarios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="a_receber">A receber</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Competência (AAAA-MM)</Label>
            <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="Ex.: 2026-07" />
          </div>
          <div className="flex items-end">
            <Button onClick={gerar} disabled={busy} className="w-full">
              <RefreshCw className="h-4 w-4 mr-1" />
              {busy ? "Gerando..." : "Gerar honorários mensais"}
            </Button>
          </div>
        </Card>

        <Card className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum honorário encontrado.</p>
          ) : rows.map((r) => {
            const prop = r.contratos_administracao?.proprietarios;
            const hoje = new Date().toISOString().slice(0, 10);
            const atrasado = !r.pago && !!r.vencimento && r.vencimento < hoje;
            return (
              <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[240px]">
                  <p className="font-medium text-primary">
                    {prop?.nome ?? "—"}{" "}
                    <span className="text-muted-foreground font-normal">
                      — {imovelLabel(r)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.tipo === "renovacao" ? "Renovação" : "Mensal"} • Comp. {competenciaLabel(r.competencia)} • Venc. {formatDateBR(r.vencimento)} • {formatBRL(r.valor)}
                    {r.percentual ? ` (${Number(r.percentual).toFixed(2)}% sobre ${formatBRL(r.base_calculo)})` : ""}
                  </p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  r.pago ? "bg-emerald-100 text-emerald-800" :
                  atrasado ? "bg-destructive/15 text-destructive" : "bg-muted"
                }`}>
                  {r.pago ? "Recebido" : atrasado ? "Atrasado" : "A receber"}
                </span>
                {!r.pago && (
                  <Button size="sm" variant="outline"
                    onClick={async () => {
                      try {
                        await marcarFn({ data: { id: r.id, pago: true } });
                        toast.success("Marcado como recebido");
                        await reload();
                      } catch (e) { toast.error((e as Error).message); }
                    }}>
                    <Check className="h-4 w-4 mr-1" /> Marcar recebido
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setDialog({ mode: r.pago ? "recibo" : "cobranca", row: r })}>
                  <FileText className="h-4 w-4 mr-1" /> {r.pago ? "Recibo" : "Cobrança"}
                </Button>
              </div>
            );
          })}
        </Card>
      </div>

      <ReciboDialog
        open={!!dialog}
        mode={dialog?.mode ?? "cobranca"}
        rowId={dialog?.row.id ?? null}
        onClose={() => setDialog(null)}
        calcularMoraFn={useServerFn(calcularMoraHonorario)}
        getDetalhesFn={useServerFn(getHonorarioDetalhes)}
      />
    </AppShell>
  );
}

// ---------- dialog de recibo / cobrança / whatsapp ----------

type Detalhes = Awaited<ReturnType<typeof getHonorarioDetalhes>>;
type Mora = Awaited<ReturnType<typeof calcularMoraHonorario>>;

function ReciboDialog(props: {
  open: boolean;
  mode: "recibo" | "cobranca";
  rowId: string | null;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calcularMoraFn: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDetalhesFn: any;
}) {
  const [det, setDet] = useState<Detalhes | null>(null);
  const [mora, setMora] = useState<Mora | null>(null);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!props.open || !props.rowId) return;
    setDet(null); setMora(null); setMensagem("");
    props.getDetalhesFn({ data: { id: props.rowId } })
      .then((d: Detalhes) => setDet(d))
      .catch((e: Error) => toast.error(e.message));
    if (props.mode === "cobranca") {
      props.calcularMoraFn({ data: { id: props.rowId } })
        .then((m: Mora) => setMora(m))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.rowId]);

  const texto = useMemo(() => {
    if (!det) return "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = det as any;
    const prop = d.contratos_administracao?.proprietarios?.nome ?? "—";
    const adm = d.contratos_administracao?.administrador_nome ?? "administrador";
    const im = d.contratos_locacao?.imoveis;
    const imLabel = im
      ? `${im.descricao || im.edificio || "imóvel"}${im.numero_unidade ? ` (un. ${im.numero_unidade})` : ""}`
      : "imóvel";
    const tipo = d.tipo === "renovacao" ? "Honorários de renovação" : "Honorários mensais";
    const compLabel = competenciaLabel(d.competencia);
    const ref = `${tipo} ${compLabel} — ${imLabel}`;
    const valor = formatBRL(Number(d.valor ?? 0));
    const venc = formatDateBR(d.vencimento);
    const pix = d.contratos_administracao?.pix_recebimento;
    const banco = d.contratos_administracao?.banco_recebimento;
    const ag = d.contratos_administracao?.agencia_recebimento;
    const conta = d.contratos_administracao?.conta_recebimento;
    const pagto: string[] = [];
    if (pix) pagto.push(`PIX: ${pix}`);
    if (banco || ag || conta) pagto.push(`Banco: ${banco ?? "—"} | Ag: ${ag ?? "—"} | Conta: ${conta ?? "—"}`);

    if (props.mode === "recibo") {
      const dPag = formatDateBR(d.data_pagamento ?? new Date().toISOString().slice(0, 10));
      return [
        `Olá, ${prop}! 👋`,
        ``,
        `Segue o recibo de *${ref}*.`,
        `Valor recebido: *${valor}* em ${dPag}.`,
        ``,
        `Obrigado pela confiança.`,
        `— ${adm}`,
      ].join("\n");
    }
    const linhasMora: string[] = [];
    if (mora && mora.diasAtraso > 0) {
      linhasMora.push("");
      linhasMora.push(`⚠️ Valor original: ${valor}`);
      linhasMora.push(`Multa (2%): ${formatBRL(mora.multa)}`);
      linhasMora.push(`Juros (1% a.m., ${mora.diasAtraso} dias): ${formatBRL(mora.juros)}`);
      linhasMora.push(`Correção IGP-M (${mora.indice.toFixed(4)}%): ${formatBRL(mora.correcao)}`);
      linhasMora.push(`*Total atualizado: ${formatBRL(mora.total)}*`);
    }
    return [
      `Olá, ${prop}! 👋`,
      ``,
      `Cobrança referente a *${ref}*.`,
      `Valor: *${valor}*`,
      `Vencimento: ${venc}`,
      ...linhasMora,
      ``,
      `Dados para pagamento:`,
      ...pagto,
      ``,
      `Qualquer dúvida, estou à disposição.`,
      `— ${adm}`,
    ].join("\n");
  }, [det, mora, props.mode]);

  useEffect(() => { setMensagem(texto); }, [texto]);

  const telefone = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (det as any)?.contratos_administracao?.proprietarios?.telefone ?? "";
    const digits = onlyDigits(t ?? "");
    if (!digits) return "";
    return digits.startsWith("55") ? digits : `55${digits}`;
  })();

  const waHref = telefone
    ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  const exportarPdf = () => {
    // impressão nativa (usuário salva como PDF)
    const w = window.open("", "_blank");
    if (!w) { toast.error("Bloqueado pelo navegador"); return; }
    const safe = mensagem.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as Record<string, string>)[c]);
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${props.mode === "recibo" ? "Recibo" : "Cobrança"} de honorários</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;max-width:640px;color:#111} pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5}</style>
      </head><body><h2>${props.mode === "recibo" ? "Recibo" : "Cobrança"} de honorários</h2><pre>${safe}</pre>
      <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.mode === "recibo" ? "Recibo de honorários" : "Cobrança de honorários"}</DialogTitle>
        </DialogHeader>
        {!det ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {props.mode === "cobranca" && mora && mora.diasAtraso > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calculator className="h-4 w-4" />
                {mora.diasAtraso} dias em atraso — total atualizado {formatBRL(mora.total)}
              </div>
            )}
            <Label>Mensagem (edite antes de enviar)</Label>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={14} />
            {!telefone && (
              <p className="text-xs text-destructive">Proprietário sem telefone cadastrado — o WhatsApp abrirá sem número.</p>
            )}
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={exportarPdf} disabled={!det}>
            <FileText className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
          <Button asChild disabled={!det}>
            <a href={waHref} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4 mr-1" /> Enviar por WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}