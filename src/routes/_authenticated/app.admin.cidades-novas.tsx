import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, MapPin } from "lucide-react";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import {
  listCidadesNovasAlertas,
  marcarCidadeResolvida,
} from "@/lib/cidades-novas.functions";

export const Route = createFileRoute("/_authenticated/app/admin/cidades-novas")({
  component: Page,
});

type Row = {
  id: string;
  cidade: string;
  uf: string;
  slug: string;
  status: "pendente" | "resolvida";
  created_at: string;
  resolvida_em: string | null;
  owner_id: string | null;
  primeiro_condominio_id: string | null;
};

function Page() {
  const listFn = useServerFn(listCidadesNovasAlertas);
  const resolveFn = useServerFn(marcarCidadeResolvida);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const reload = () => {
    listFn().then((r) => setRows(r as Row[])).catch(() => {});
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  return (
    <AppShell>
      <div className="max-w-5xl">
        <header className="app-page-header">
          <span className="app-eyebrow">Administração</span>
          <h1 className="app-title">Cidades novas</h1>
          <p className="app-subtitle">
            Cidades cadastradas por usuários que ainda não têm legislação municipal indexada.
          </p>
        </header>
        <div className="mt-6"><AdminNav /></div>

        <Card className="app-card divide-y divide-[var(--landing-rule)]">
          {rows.length === 0 ? (
            <AppEmptyState icon={<MapPin />} title="Nenhuma cidade nova no momento" />
          ) : rows.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-3 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <MapPin className="h-4 w-4 text-accent" />
                <div>
                  <p className="font-medium text-primary">{r.cidade} / {r.uf}</p>
                  <p className="text-xs text-muted-foreground">
                    Cadastrada em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === "pendente" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                {r.status === "pendente" ? "Pendente" : "Atualizada"}
              </span>
              {r.status === "pendente" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === r.id}
                  onClick={async () => {
                    setLoading(r.id);
                    try {
                      await resolveFn({ data: { id: r.id, cidade: r.cidade, uf: r.uf } });
                      toast.success("Cidade marcada como atualizada");
                      reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha");
                    } finally {
                      setLoading(null);
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Marcar como atualizada
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}