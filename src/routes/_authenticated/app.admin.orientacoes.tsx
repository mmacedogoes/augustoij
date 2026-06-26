import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listOrientacoes,
  upsertOrientacao,
  deleteOrientacao,
} from "@/lib/admin-kb.functions";

export const Route = createFileRoute("/_authenticated/app/admin/orientacoes")({
  component: Page catch {
      throw redirect({ to: "/app" });
    }
  },
});

type Row = {
  id: string;
  titulo: string;
  conteudo: string;
  ativo: boolean;
  ordem: number;
  updated_at: string;
};

function Page() {
  const fetchRows = useServerFn(listOrientacoes);
  const save = useServerFn(upsertOrientacao);
  const remove = useServerFn(deleteOrientacao);
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(
    () =>
      fetchRows()
        .then((r) => setRows(r as Row[]))
        .catch(() => {}),
    [fetchRows],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startNew = () => {
    setEditing({
      id: "",
      titulo: "",
      conteudo: "",
      ativo: true,
      ordem: rows.length,
      updated_at: "",
    });
    setOpen(true);
  };

  const toggleActive = async (r: Row) => {
    try {
      await save({
        data: { id: r.id, titulo: r.titulo, conteudo: r.conteudo, ativo: !r.ativo, ordem: r.ordem },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta orientação?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Removida");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-primary">Orientações da IA</h1>
        <p className="text-muted-foreground">
          Regras e diretrizes globais injetadas no prompt do assistente. Use para definir tom,
          limites éticos, citação obrigatória, etc.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <div className="mb-4">
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova orientação
          </Button>
        </div>

        <Card className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma orientação cadastrada.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-4 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-primary truncate">{r.titulo}</p>
                    {!r.ativo && (
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                        inativa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.conteudo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.ativo} onCheckedChange={() => toggleActive(r)} />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar orientação" : "Nova orientação"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <OrientacaoForm
                initial={editing}
                onSave={async (vals) => {
                  try {
                    await save({
                      data: {
                        id: editing.id || undefined,
                        titulo: vals.titulo,
                        conteudo: vals.conteudo,
                        ativo: vals.ativo,
                        ordem: vals.ordem,
                      },
                    });
                    toast.success("Salvo");
                    setOpen(false);
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Falha");
                  }
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function OrientacaoForm({
  initial,
  onSave,
}: {
  initial: Row;
  onSave: (vals: { titulo: string; conteudo: string; ativo: boolean; ordem: number }) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(initial.titulo);
  const [conteudo, setConteudo] = useState(initial.conteudo);
  const [ativo, setAtivo] = useState(initial.ativo);
  const [ordem, setOrdem] = useState<number>(initial.ordem);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave({ titulo, conteudo, ativo, ordem });
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-3"
    >
      <div>
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </div>
      <div>
        <Label>Conteúdo</Label>
        <Textarea
          rows={8}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Ex.: Sempre citar a fonte legal quando responder sobre cotas condominiais."
          required
        />
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={ativo} onCheckedChange={setAtivo} />
          <Label>Ativa</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label>Ordem</Label>
          <Input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value) || 0)}
            className="w-20"
          />
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
        Salvar
      </Button>
    </form>
  );
}