import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Building } from "lucide-react";
import { listCondominiosAdmin } from "@/lib/admin.functions";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";

export const Route = createFileRoute("/_authenticated/app/admin/condominios")({
  component: Page,
});

type Row = {
  id: string;
  nome: string;
  uf: string | null;
  cidade: string | null;
  qtd_unidades: number | null;
  owner_id: string;
  created_at: string;
  profiles: { email: string | null; nome: string | null } | null;
};

function Page() {
  const fetchRows = useServerFn(listCondominiosAdmin);
  const [rows, setRows] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRows()
      .then((r) => setRows(r as unknown as Row[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchRows]);

  return (
    <AppShell>
      <div className="max-w-6xl">
        <header className="app-page-header">
          <span className="app-eyebrow">Administração</span>
          <h1 className="app-title">Condomínios</h1>
          <p className="app-subtitle">Visão global de todos os condomínios cadastrados.</p>
        </header>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Card className="app-card divide-y divide-[var(--landing-rule)]">
          {loading ? (
            <div className="p-6">
              <AppSkeletonLines lines={4} />
            </div>
          ) : rows.length === 0 ? (
            <AppEmptyState
              icon={<Building />}
              title="Nenhum condomínio cadastrado"
              description="Ainda não há condomínios cadastrados na plataforma."
            />
          ) : (
            rows.map((c) => (
              <div key={c.id} className="p-4 flex flex-wrap items-center gap-3 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-medium text-primary">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : c.uf ?? "—"} • {c.qtd_unidades ?? 0} unidades
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Dono: {c.profiles?.nome || c.profiles?.email || c.owner_id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </div>
                <Link
                  to="/app/condominios/$id"
                  params={{ id: c.id }}
                  search={{ admin_view: true }}
                >
                  <Button size="sm" variant="outline">
                    <Eye className="h-4 w-4 mr-1" /> Visualizar
                  </Button>
                </Link>
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}