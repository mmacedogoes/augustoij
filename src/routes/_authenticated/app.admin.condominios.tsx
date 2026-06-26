import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { listCondominiosAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin/condominios")({
  component: Page catch {
      throw redirect({ to: "/app" });
    }
  },
});

type Row = {
  id: string;
  nome: string;
  uf: string | null;
  qtd_unidades: number | null;
  owner_id: string;
  created_at: string;
  profiles: { email: string | null; nome: string | null } | null;
};

function Page() {
  const fetchRows = useServerFn(listCondominiosAdmin);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetchRows().then((r) => setRows(r as unknown as Row[])).catch(() => {});
  }, [fetchRows]);

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Condomínios</h1>
        <p className="text-muted-foreground">Visão global de todos os condomínios cadastrados.</p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Card className="divide-y">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum condomínio cadastrado.</p>
          ) : (
            rows.map((c) => (
              <div key={c.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-medium text-primary">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.uf ?? "—"} • {c.qtd_unidades ?? 0} unidades
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dono: {c.profiles?.nome || c.profiles?.email || c.owner_id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}