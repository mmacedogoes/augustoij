import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Check, Loader2, RefreshCw, Trash2 } from "lucide-react";
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
  cancelarEvento,
  concluirEvento,
  gerarEventosDoContrato,
  listEventosDoContrato,
  upsertEventoManual,
  type EventoLinha,
} from "@/lib/contratos-servico/eventos.functions";
import { etiquetaTipoEvento, hojeBR, type TipoEvento } from "@/lib/contratos-servico/eventos-core";

export function AgendaPanel({ contratoId }: { contratoId: string }) {
  const listFn = useServerFn(listEventosDoContrato);
  const gerarFn = useServerFn(gerarEventosDoContrato);
  const upsertFn = useServerFn(upsertEventoManual);
  const concluirFn = useServerFn(concluirEvento);
  const cancelarFn = useServerFn(cancelarEvento);

  const [rows, setRows] = useState<EventoLinha[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [regerando, setRegerando] = useState(false);
  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataEvento, setDataEvento] = useState<string>(() => hojeBR());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listFn({ data: { contratoId } });
      setRows(r.rows);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
    } finally {
      setCarregando(false);
    }
  }, [listFn, contratoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const grupos = useMemo(() => {
    const pendentes: EventoLinha[] = [];
    const passadosOuFechados: EventoLinha[] = [];
    const hoje = hojeBR();
    for (const ev of rows ?? []) {
      if (ev.status === "pendente" && ev.data_evento >= hoje) pendentes.push(ev);
      else passadosOuFechados.push(ev);
    }
    return { pendentes, passados: passadosOuFechados };
  }, [rows]);

  async function regenerar() {
    setRegerando(true);
    try {
      await gerarFn({ data: { contratoId } });
      toast.success("Agenda atualizada.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a agenda.");
    } finally {
      setRegerando(false);
    }
  }

  async function salvarManual() {
    const t = titulo.trim();
    if (t.length === 0) { toast.error("Informe um título."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) { toast.error("Informe a data."); return; }
    setSalvando(true);
    try {
      await upsertFn({
        data: { contratoId, titulo: t, descricao: descricao.trim() || null, data_evento: dataEvento },
      });
      toast.success("Lembrete adicionado.");
      setNovoAberto(false);
      setTitulo("");
      setDescricao("");
      setDataEvento(hojeBR());
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function concluir(id: string) {
    try {
      await concluirFn({ data: { eventoId: id } });
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: "concluido" } : r)) ?? null);
      toast.success("Marcado como concluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  }

  async function cancelar(id: string) {
    try {
      await cancelarFn({ data: { eventoId: id } });
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: "cancelado" } : r)) ?? null);
      toast.success("Evento cancelado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar.");
    }
  }

  return (
    <Card className="app-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-serif text-primary">Agenda do contrato</h3>
          <p className="text-sm text-muted-foreground">
            Eventos automáticos + lembretes que você criar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={regenerar} disabled={regerando}>
            <RefreshCw className={`h-4 w-4 mr-1 ${regerando ? "animate-spin" : ""}`} />
            Recalcular automáticos
          </Button>
          <Button size="sm" onClick={() => setNovoAberto(true)}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Novo lembrete
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : (rows?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem eventos ainda. Clique em "Recalcular automáticos" para gerar a partir das datas do contrato,
          ou "Novo lembrete" para criar um evento manual.
        </p>
      ) : (
        <div className="space-y-6">
          <Secao titulo="Próximos" itens={grupos.pendentes} onConcluir={concluir} onCancelar={cancelar} />
          <Secao titulo="Histórico" itens={grupos.passados} onConcluir={concluir} onCancelar={cancelar} historico />
        </div>
      )}

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lembrete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lembrete-titulo">Título</Label>
              <Input
                id="lembrete-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={200}
                placeholder="Ex.: Revisar SLA com o prestador"
              />
            </div>
            <div>
              <Label htmlFor="lembrete-desc">Descrição (opcional)</Label>
              <Textarea
                id="lembrete-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="lembrete-data">Data</Label>
              <Input
                id="lembrete-data"
                type="date"
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvarManual} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Secao({
  titulo, itens, onConcluir, onCancelar, historico = false,
}: {
  titulo: string;
  itens: EventoLinha[];
  onConcluir: (id: string) => void;
  onCancelar: (id: string) => void;
  historico?: boolean;
}) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{titulo}</p>
      <ul className="divide-y divide-[var(--landing-rule)] rounded-md border border-border">
        {itens.map((ev) => (
          <li key={ev.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {etiquetaTipoEvento(ev.tipo as TipoEvento)}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateBR(ev.data_evento)}</span>
                {ev.status !== "pendente" ? (
                  <span className={`text-[10px] uppercase tracking-wide ${ev.status === "concluido" ? "text-augusto-green" : "text-muted-foreground"}`}>
                    {ev.status === "concluido" ? "concluído" : "cancelado"}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium mt-0.5">{ev.titulo}</p>
              {ev.descricao ? (
                <p className="text-xs text-muted-foreground mt-0.5">{ev.descricao}</p>
              ) : null}
            </div>
            {!historico && ev.status === "pendente" ? (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => onConcluir(ev.id)}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Concluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onCancelar(ev.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}