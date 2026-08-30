import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  listInfracoes,
  registrarInfracao,
  excluirInfracao,
} from "@/lib/infracoes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tipo = "notificacao" | "advertencia" | "multa" | "comunicado";

type Row = {
  id: string;
  tipo: string | null;
  categoria: string | null;
  descricao: string | null;
  ocorrido_em: string | null;
  created_at: string;
  base_normativa: string | null;
  valor_multa: number | null;
};

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "notificacao", label: "Notificação" },
  { value: "advertencia", label: "Advertência" },
  { value: "multa", label: "Multa" },
  { value: "comunicado", label: "Comunicado" },
];

function dataBr(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function HistoricoInfracoesDialog({
  condominioId,
  unidadeId,
  titulo,
  podeEditar,
  onClose,
}: {
  condominioId: string;
  unidadeId: string;
  titulo: string;
  podeEditar: boolean;
  onClose: () => void;
}) {
  const listFn = useServerFn(listInfracoes);
  const createFn = useServerFn(registrarInfracao);
  const deleteFn = useServerFn(excluirInfracao);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "notificacao" as Tipo,
    categoria: "",
    descricao: "",
    ocorrido_em: "",
    base_normativa: "",
    valor_multa: "",
  });

  function reload() {
    setLoading(true);
    listFn({ data: { condominioId, unidadeId } })
      .then((r) => setRows((r as Row[]) ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));
  }
  useEffect(reload, [unidadeId]);

  async function salvar() {
    if (form.categoria.trim().length < 2) {
      toast.error("Informe o motivo/categoria da ocorrência.");
      return;
    }
    setSaving(true);
    try {
      await createFn({
        data: {
          condominioId,
          unidadeId,
          tipo: form.tipo,
          categoria: form.categoria.trim(),
          descricao: form.descricao.trim() || null,
          ocorrido_em: form.ocorrido_em ? new Date(form.ocorrido_em).toISOString() : null,
          base_normativa: form.base_normativa.trim() || null,
          valor_multa: form.valor_multa ? Number(form.valor_multa) : null,
        },
      });
      toast.success("Ocorrência registrada.");
      setForm({
        tipo: "notificacao",
        categoria: "",
        descricao: "",
        ocorrido_em: "",
        base_normativa: "",
        valor_multa: "",
      });
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setSaving(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta ocorrência do histórico?")) return;
    try {
      await deleteFn({ data: { id } });
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  const reincidencias = new Map<string, number>();
  for (const r of rows) {
    const k = (r.categoria ?? "").trim().toLowerCase();
    if (k) reincidencias.set(k, (reincidencias.get(k) ?? 0) + 1);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da unidade {titulo}</DialogTitle>
          <DialogDescription>
            Notificações, advertências, multas e comunicados já emitidos. A IA usa este
            histórico para identificar reincidência e aplicar a gradação prevista na
            convenção, regimento interno ou ata.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto mb-2 animate-spin" /> Carregando…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência registrada para esta unidade.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((r) => {
              const k = (r.categoria ?? "").trim().toLowerCase();
              const total = reincidencias.get(k) ?? 1;
              return (
                <li key={r.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {TIPOS.find((t) => t.value === r.tipo)?.label ?? r.tipo} —{" "}
                      {r.categoria}
                      {total > 1 && (
                        <span className="ml-2 text-xs text-destructive">
                          {total}ª ocorrência da mesma categoria
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dataBr(r.ocorrido_em ?? r.created_at)}
                      {r.valor_multa ? ` • multa R$ ${Number(r.valor_multa).toFixed(2)}` : ""}
                      {r.base_normativa ? ` • ${r.base_normativa}` : ""}
                    </p>
                    {r.descricao && (
                      <p className="text-xs mt-1 whitespace-pre-wrap">{r.descricao}</p>
                    )}
                  </div>
                  {podeEditar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => remover(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {podeEditar && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Registrar nova ocorrência</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Tipo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Motivo / categoria</Label>
                <Input
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ex.: barulho após as 22h"
                />
              </div>
              <div>
                <Label>Data da ocorrência</Label>
                <Input
                  type="date"
                  value={form.ocorrido_em}
                  onChange={(e) => setForm((f) => ({ ...f, ocorrido_em: e.target.value }))}
                />
              </div>
              <div>
                <Label>Valor da multa (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor_multa}
                  onChange={(e) => setForm((f) => ({ ...f, valor_multa: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Base normativa (opcional)</Label>
                <Input
                  value={form.base_normativa}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, base_normativa: e.target.value }))
                  }
                  placeholder="Ex.: art. 12 do Regimento Interno"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={salvar} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Registrar ocorrência
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
