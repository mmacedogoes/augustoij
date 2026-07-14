import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, LayoutDashboard } from "lucide-react";
import { listContratosLocacao, removeContratoLocacao } from "@/lib/imoveis/contratos-locacao.functions";
import { formatBRL, formatDateBR } from "@/lib/imoveis/masks";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/locacao/")({
  component: Page,
});

type Row = {
  id: string;
  inquilino_nome: string | null;
  valor_aluguel: number | null;
  status: string;
  data_inicio_vigencia: string | null;
  imoveis: {
    descricao: string | null; endereco: string | null; edificio: string | null; numero_unidade: string | null;
    proprietarios: { nome: string } | null;
  } | null;
};

function Page() {
  const listFn = useServerFn(listContratosLocacao);
  const removeFn = useServerFn(removeContratoLocacao);
  const [rows, setRows] = useState<Row[]>([]);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const reload = () => listFn().then((r) => setRows(r.rows as unknown as Row[])).catch((e) => toast.error(e.message));
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Contratos de locação</h1>
        <p className="text-muted-foreground">Vínculo entre imóvel e inquilino.</p>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <div className="flex justify-end mb-4">
          <Link to="/app/admin/imoveis/locacao/$id" params={{ id: "novo" }}>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo contrato</Button>
          </Link>
        </div>
        <Card className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum contrato cadastrado ainda.</p>
          ) : rows.map((r) => {
            const im = r.imoveis;
            const imStr = im
              ? `${im.descricao || im.edificio || im.endereco || "Imóvel"}${im.numero_unidade ? ` — un. ${im.numero_unidade}` : ""}`
              : "Imóvel";
            return (
              <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[240px]">
                  <p className="font-medium text-primary">
                    {r.inquilino_nome ?? "Sem inquilino"} <span className="text-muted-foreground font-normal">— {imStr}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Proprietário: {im?.proprietarios?.nome ?? "—"} • Início: {formatDateBR(r.data_inicio_vigencia)} • {formatBRL(r.valor_aluguel)}/mês
                  </p>
                </div>
                <span className="text-xs rounded-full bg-muted px-2 py-0.5">{r.status}</span>
                <Link to="/app/admin/imoveis/locacao/$id/painel" params={{ id: r.id }}>
                  <Button size="sm" variant="secondary"><LayoutDashboard className="h-4 w-4 mr-1" /> Painel</Button>
                </Link>
                <Link to="/app/admin/imoveis/locacao/$id" params={{ id: r.id }}>
                  <Button size="sm" variant="outline"><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              </div>
            );
          })}
        </Card>
      </div>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato de locação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação também removerá caução, pagamentos e aditivos vinculados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await removeFn({ data: { id: toDelete.id } });
                  toast.success("Contrato excluído");
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