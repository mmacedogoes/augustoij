import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { isCurrentUserAdmin, listAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin/auditoria")({
  component: Page catch {
      throw redirect({ to: "/app" });
    }
  },
});

type Row = {
  id: string;
  actor_user_id: string;
  action: string;
  target_user_id: string | null;
  target_condominio_id: string | null;
  target_kb_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function Page() {
  const fetchRows = useServerFn(listAuditLog);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetchRows({ data: { limit: 100 } })
      .then((r) => setRows(r as unknown as Row[]))
      .catch(() => {});
  }, [fetchRows]);

  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold text-primary">Auditoria</h1>
        <p className="text-muted-foreground">Ações administrativas registradas no sistema.</p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Card className="divide-y font-mono text-xs">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground font-sans">Sem registros.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-3">
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </span>{" "}
                — <span className="text-accent">{r.action}</span> por {r.actor_user_id.slice(0, 8)}
                {r.target_user_id && <> · alvo user {r.target_user_id.slice(0, 8)}</>}
                {r.target_kb_id && <> · alvo kb {r.target_kb_id.slice(0, 8)}</>}
                {Object.keys(r.metadata || {}).length > 0 && (
                  <pre className="mt-1 text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(r.metadata)}
                  </pre>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}