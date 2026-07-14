import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listProprietarios, removeProprietario } from "@/lib/imoveis/proprietarios.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/proprietarios/")({
  component: Page,
});

type Row = { id: string; nome: string; cpf: string | null; email: string | null; telefone: string | null };

function Page() {
  const listFn = useServerFn(listProprietarios);
  const removeFn = useServerFn(removeProprietario);
  const [rows, setRows] = useState<Row[]>([]);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const reload = () => listFn().then((r) => setRows(r.rows as Row[])).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Proprietários</h1>
        <p className="text-muted-foreground">Donos dos imóveis administrados.</p>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <div className="flex justify-end mb-4">
          <Link to="/app/admin/imoveis/proprietarios/$id" params={{ id: "novo" }}>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo proprietário</Button>
          </Link>
        </div>
        <Card className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum proprietário cadastrado ainda.</p>
          ) : rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className="font-medium text-primary">{r.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {r.cpf ?? "sem CPF"} • {r.email ?? "sem e-mail"} • {r.telefone ?? "sem telefone"}
                </p>
              </div>
              <Link to="/app/admin/imoveis/proprietarios/$id" params={{ id: r.id }}>
                <Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </div>
          ))}
        </Card>
      </div>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Imóveis vinculados impedirão a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await removeFn({ data: { id: toDelete.id } });
                  toast.success("Proprietário excluído");
                  setToDelete(null);
                  reload();
                } catch (e) { toast.error((e as Error).message); }
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}