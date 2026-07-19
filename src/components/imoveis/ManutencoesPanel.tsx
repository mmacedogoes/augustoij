import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import {
  listManutencoesPorImovel, upsertManutencao, removeManutencao,
} from "@/lib/imoveis/manutencoes.functions";
import { formatBRL, formatDateBR } from "@/lib/imoveis/masks";

type Row = {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavel: "proprietario" | "inquilino" | "administrador" | "condominio";
  status: "solicitada" | "em_andamento" | "concluida" | "cancelada";
  custo_estimado: number | null;
  custo_final: number | null;
  data_solicitacao: string;
  data_conclusao: string | null;
};

const RESPONSAVEIS = ["proprietario", "inquilino", "administrador", "condominio"] as const;
const STATUSES = ["solicitada", "em_andamento", "concluida", "cancelada"] as const;

function emptyForm(imovelId: string): Row & { imovel_id: string } {
  return {
    id: "",
    imovel_id: imovelId,
    titulo: "",
    descricao: "",
    responsavel: "proprietario",
    status: "solicitada",
    custo_estimado: null,
    custo_final: null,
    data_solicitacao: new Date().toISOString().slice(0, 10),
    data_conclusao: null,
  };
}

export function ManutencoesPanel({ imovelId }: { imovelId: string }) {
  const listFn = useServerFn(listManutencoesPorImovel);
  const saveFn = useServerFn(upsertManutencao);
  const removeFn = useServerFn(removeManutencao);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm(imovelId));

  const reload = () =>
    listFn({ data: { imovelId } })
      .then((r) => setRows(r.rows as unknown as Row[]))
      .catch((e) => toast.error((e as Error).message));

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [imovelId]);

  const abrirNovo = () => { setForm(emptyForm(imovelId)); setOpen(true); };
  const abrirEditar = (r: Row) => { setForm({ ...r, imovel_id: imovelId, descricao: r.descricao ?? "" }); setOpen(true); };

  const salvar = async () => {
    if (!form.titulo.trim()) { toast.error("Informe o título"); return; }
    try {
      await saveFn({
        data: {
          id: form.id || undefined,
          imovel_id: imovelId,
          titulo: form.titulo,
          descricao: form.descricao || null,
          responsavel: form.responsavel,
          status: form.status,
          custo_estimado: form.custo_estimado,
          custo_final: form.custo_final,
          data_solicitacao: form.data_solicitacao,
          data_conclusao: form.data_conclusao,
        },
      });
      toast.success("Manutenção salva");
      setOpen(false);
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta manutenção?")) return;
    try { await removeFn({ data: { id } }); toast.success("Removida"); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Wrench className="h-4 w-4" /> Manutenções ({rows.length})
        </div>
        <Button size="sm" onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" /> Nova manutenção</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="font-medium">{r.titulo}</p>
                {r.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{r.descricao}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Solicitada em {formatDateBR(r.data_solicitacao)}
                  {r.data_conclusao ? ` • Concluída em ${formatDateBR(r.data_conclusao)}` : ""}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">{r.responsavel}</Badge>
              <Badge className="capitalize">{r.status.replace("_", " ")}</Badge>
              <div className="min-w-[110px] text-right">
                <p className="text-xs text-muted-foreground">Custo final</p>
                <p className="text-sm font-medium">{formatBRL(r.custo_final ?? r.custo_estimado)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => abrirEditar(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => excluir(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar manutenção" : "Nova manutenção"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsavel} onValueChange={(v) => setForm({ ...form, responsavel: v as Row["responsavel"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESPONSAVEIS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Row["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custo estimado (R$)</Label>
                <Input type="number" step="0.01"
                  value={form.custo_estimado ?? ""}
                  onChange={(e) => setForm({ ...form, custo_estimado: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Custo final (R$)</Label>
                <Input type="number" step="0.01"
                  value={form.custo_final ?? ""}
                  onChange={(e) => setForm({ ...form, custo_final: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Data de solicitação</Label>
                <Input type="date" value={form.data_solicitacao} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} />
              </div>
              <div>
                <Label>Data de conclusão</Label>
                <Input type="date" value={form.data_conclusao ?? ""} onChange={(e) => setForm({ ...form, data_conclusao: e.target.value || null })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}