import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, History, Loader2, RotateCcw, TrendingUp, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  aplicarReajuste,
  adiarReajuste,
  desfazerUltimoReajuste,
  getSugestaoReajuste,
  listHistoricoReajustes,
  type ReajusteLinha,
} from "@/lib/contratos-servico/reajustes.functions";
import { rotuloIndiceContrato } from "@/lib/contratos-servico/indices";

type Ficha = {
  id: string;
  valor: number | null;
  indice_reajuste: string | null;
  mes_base_reajuste: number | null;
  ultimo_reajuste_em: string | null;
  situacao: string;
};

type Sugestao = Awaited<ReturnType<typeof getSugestaoReajuste>>;

export function ReajustesPanel({ contrato, onChange }: { contrato: Ficha; onChange: () => void }) {
  const sugestaoFn = useServerFn(getSugestaoReajuste);
  const aplicarFn = useServerFn(aplicarReajuste);
  const adiarFn = useServerFn(adiarReajuste);
  const desfazerFn = useServerFn(desfazerUltimoReajuste);
  const histFn = useServerFn(listHistoricoReajustes);

  const [sug, setSug] = useState<Sugestao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [hist, setHist] = useState<ReajusteLinha[] | null>(null);

  // Estado editável do reajuste sugerido.
  const [percentual, setPercentual] = useState<string>("");
  const [valorNovo, setValorNovo] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dispensar, setDispensar] = useState(false);
  const [motivoDispensa, setMotivoDispensa] = useState("");
  const [desfazerConfirmar, setDesfazerConfirmar] = useState(false);

  const semReajuste = !contrato.mes_base_reajuste || contrato.indice_reajuste === "nenhum";

  const carregar = useCallback(() => {
    setHist(null);
    histFn({ data: { contratoId: contrato.id } })
      .then((r) => setHist(r.rows))
      .catch((e: Error) => toast.error(e.message));
  }, [histFn, contrato.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (semReajuste) {
      setCarregando(false);
      return;
    }
    let alive = true;
    setCarregando(true);
    setErro(null);
    sugestaoFn({ data: { contratoId: contrato.id } })
      .then((r) => {
        if (!alive) return;
        setSug(r);
        const pct = r.acumuladoSugerido ?? 0;
        setPercentual(pct.toFixed(4));
        setValorNovo(r.valorSugerido.toFixed(2));
      })
      .catch((e: Error) => { if (alive) setErro(e.message); })
      .finally(() => { if (alive) setCarregando(false); });
    return () => { alive = false; };
  }, [sugestaoFn, contrato.id, semReajuste]);

  const valorAtual = Number(contrato.valor ?? 0);

  const pendente = useMemo(() => {
    if (!hist || semReajuste || !sug) return false;
    return !hist.some((h) => h.competencia === sug.competencia);
  }, [hist, semReajuste, sug]);

  function onPercentualChange(v: string) {
    setPercentual(v);
    const p = Number(v.replace(",", "."));
    if (Number.isFinite(p)) {
      const novo = valorAtual * (1 + p / 100);
      setValorNovo(novo.toFixed(2));
    }
  }
  function onValorChange(v: string) {
    setValorNovo(v);
    const nv = Number(v.replace(",", "."));
    if (Number.isFinite(nv) && valorAtual > 0) {
      const p = (nv / valorAtual - 1) * 100;
      setPercentual(p.toFixed(4));
    }
  }

  async function handleAplicar() {
    if (!sug) return;
    const p = Number(percentual.replace(",", "."));
    const nv = Number(valorNovo.replace(",", "."));
    if (!Number.isFinite(nv) || nv <= 0) {
      toast.error("Valor novo inválido");
      return;
    }
    if (!Number.isFinite(p)) {
      toast.error("Percentual inválido");
      return;
    }
    setSalvando(true);
    try {
      const indiceUtilizado = sug.substituicaoPorNegativo && sug.indiceSugerido === "ipca"
        ? "IPCA (substituição por IGP-M negativo)"
        : rotuloIndiceContrato(sug.indiceContratual);
      await aplicarFn({
        data: {
          contratoId: contrato.id,
          competencia: sug.competencia,
          valorNovo: Math.round(nv * 100) / 100,
          percentualAplicado: Math.round(p * 10000) / 10000,
          percentualIndice: sug.acumuladoContratual ?? null,
          indiceUtilizado,
          fonte: sug.erroApi ? "manual" : "bcb",
          observacao: observacao.trim() || null,
        },
      });
      toast.success("Reajuste aplicado");
      setConfirmar(false);
      setObservacao("");
      onChange();
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aplicar");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDispensar() {
    if (!sug) return;
    if (motivoDispensa.trim().length < 3) {
      toast.error("Explique o motivo (mínimo 3 caracteres)");
      return;
    }
    setSalvando(true);
    try {
      await adiarFn({
        data: {
          contratoId: contrato.id,
          competencia: sug.competencia,
          motivo: motivoDispensa.trim(),
        },
      });
      toast.success("Competência dispensada");
      setDispensar(false);
      setMotivoDispensa("");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível dispensar");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDesfazer() {
    setSalvando(true);
    try {
      await desfazerFn({ data: { contratoId: contrato.id } });
      toast.success("Último reajuste desfeito");
      setDesfazerConfirmar(false);
      onChange();
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desfazer");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="app-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-augusto-green" />
          <h3 className="text-lg font-serif text-primary">Situação atual</h3>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2 text-sm">
          <Item label="Valor vigente" value={formatBRL(valorAtual)} />
          <Item label="Índice contratual" value={rotuloIndiceContrato(contrato.indice_reajuste)} />
          <Item label="Mês base" value={contrato.mes_base_reajuste ? String(contrato.mes_base_reajuste).padStart(2, "0") : "—"} />
          <Item
            label="Último reajuste"
            value={contrato.ultimo_reajuste_em ? formatDate(contrato.ultimo_reajuste_em) : "Nenhum reajuste aplicado"}
          />
        </dl>
      </Card>

      {semReajuste ? (
        <Card className="app-card p-4 text-sm text-muted-foreground">
          Este contrato não possui reajuste programado (índice "{rotuloIndiceContrato(contrato.indice_reajuste)}" ou mês base não definido).
        </Card>
      ) : carregando ? (
        <Card className="app-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando índice…
        </Card>
      ) : erro ? (
        <Card className="app-card p-4 text-sm text-destructive">{erro}</Card>
      ) : sug && pendente ? (
        <Card className="app-card p-4 border-augusto-gold/40 bg-augusto-gold/5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="app-eyebrow text-augusto-gold">Reajuste pendente</p>
              <h3 className="text-lg font-serif text-primary">
                Competência {formatDate(sug.competencia)}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Janela: {String(sug.janela.mesIni).padStart(2, "0")}/{sug.janela.anoIni} a {String(sug.janela.mesFim).padStart(2, "0")}/{sug.janela.anoFim}
            </span>
          </div>

          {sug.erroApi ? (
            <div className="mb-3 rounded-md border border-border bg-muted/50 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Índice não pôde ser consultado</p>
                <p className="text-muted-foreground text-xs">
                  A API do Banco Central respondeu com erro. Preencha o percentual manualmente e a aplicação será registrada com fonte "manual".
                </p>
              </div>
            </div>
          ) : sug.substituicaoPorNegativo ? (
            <div className="mb-3 rounded-md border border-augusto-gold/40 bg-augusto-gold/10 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-augusto-gold" />
              <div>
                <p className="font-medium">IGP-M acumulado ficou negativo ({(sug.acumuladoContratual ?? 0).toFixed(4)}%)</p>
                <p className="text-muted-foreground text-xs">
                  Sugestão automática: aplicar o IPCA acumulado ({sug.acumuladoSugerido != null ? sug.acumuladoSugerido.toFixed(4) : "—"}%).
                  O índice contratual continua sendo o IGP-M — você pode ajustar o percentual manualmente abaixo se quiser aplicá-lo mesmo assim.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Valor atual</Label>
              <p className="text-lg font-semibold">{formatBRL(valorAtual)}</p>
            </div>
            <div>
              <Label>Valor sugerido</Label>
              <p className="text-lg font-semibold text-augusto-green">
                {sug.valorSugerido > 0 ? formatBRL(sug.valorSugerido) : "—"}
              </p>
            </div>
            <div>
              <Label htmlFor="pct">Percentual (%)</Label>
              <Input id="pct" inputMode="decimal" value={percentual} onChange={(e) => onPercentualChange(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="vn">Valor novo (R$)</Label>
              <Input id="vn" inputMode="decimal" value={valorNovo} onChange={(e) => onValorChange(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={500} />
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Button onClick={() => setConfirmar(true)} disabled={salvando}>Aplicar reajuste</Button>
            <Button variant="outline" onClick={() => setDispensar(true)} disabled={salvando}>
              Dispensar esta competência
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="app-card p-4 text-sm text-muted-foreground">
          Nenhum reajuste pendente para {sug ? formatDate(sug.competencia) : "esta competência"}.
        </Card>
      )}

      <Card className="app-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-augusto-green" />
          <h3 className="text-lg font-serif text-primary">Histórico</h3>
        </div>
        {hist === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
          </p>
        ) : hist.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum reajuste aplicado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Competência</th>
                  <th className="py-2 pr-2">Anterior</th>
                  <th className="py-2 pr-2">Novo</th>
                  <th className="py-2 pr-2">%</th>
                  <th className="py-2 pr-2">Índice</th>
                  <th className="py-2 pr-2">Fonte</th>
                  <th className="py-2 pr-2">Aplicado por</th>
                  <th className="py-2 pr-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((r, idx) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="py-2 pr-2">{formatDate(r.competencia)}</td>
                    <td className="py-2 pr-2">{formatBRL(Number(r.valor_anterior))}</td>
                    <td className="py-2 pr-2">{formatBRL(Number(r.valor_novo))}</td>
                    <td className="py-2 pr-2">{Number(r.percentual_aplicado).toFixed(4)}%</td>
                    <td className="py-2 pr-2">{r.indice_utilizado}</td>
                    <td className="py-2 pr-2 uppercase text-xs">{r.fonte}</td>
                    <td className="py-2 pr-2">{r.aplicado_por_nome ?? "—"}</td>
                    <td className="py-2 pr-2 text-right">
                      {idx === 0 ? (
                        <Button variant="ghost" size="sm" onClick={() => setDesfazerConfirmar(true)}>
                          <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar reajuste?</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              De <strong>{formatBRL(valorAtual)}</strong> para{" "}
              <strong className="text-augusto-green">{formatBRL(Number(valorNovo.replace(",", ".")) || 0)}</strong>{" "}
              ({Number(percentual.replace(",", ".") || "0").toFixed(4)}%).
            </p>
            <p className="text-muted-foreground">
              Competência: {sug ? formatDate(sug.competencia) : "—"}. O valor do contrato será atualizado e a agenda regerada com a próxima data-base.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleAplicar} disabled={salvando}>
              {salvando ? "Aplicando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dispensar} onOpenChange={setDispensar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispensar esta competência?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Esta competência sairá do painel de pendências sem alterar o valor do contrato. O motivo fica registrado no histórico.
            </p>
            <Label htmlFor="mot">Motivo</Label>
            <Textarea id="mot" value={motivoDispensa} onChange={(e) => setMotivoDispensa(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispensar(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleDispensar} disabled={salvando}>
              {salvando ? "Salvando…" : "Dispensar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={desfazerConfirmar} onOpenChange={setDesfazerConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desfazer o último reajuste?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O valor do contrato voltará ao valor anterior e a linha do histórico será apagada. Use para corrigir erros de digitação.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesfazerConfirmar(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDesfazer} disabled={salvando}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              {salvando ? "Desfazendo…" : "Desfazer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words">{value}</dd>
    </div>
  );
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}