import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin/auditoria")({
  component: Page,
});

type Row = {
  id: string;
  actor_user_id: string;
  action: string;
  target_user_id: string | null;
  target_condominio_id: string | null;
  target_kb_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor: { nome: string | null; email: string | null } | null;
  target_user: { nome: string | null; email: string | null } | null;
};

function Page() {
  const fetchRows = useServerFn(listAuditLog);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [sinceDays, setSinceDays] = useState<number>(30);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchRows({ data: { limit: 200, action, search, sinceDays } })
      .then((r) => setRows(r as unknown as Row[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));
  }, [fetchRows, action, search, sinceDays]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const actionsDisponiveis = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );

  const exportCSV = () => {
    const header = [
      "data",
      "acao",
      "ator_email",
      "ator_id",
      "alvo_email",
      "alvo_user_id",
      "alvo_condominio_id",
      "alvo_kb_id",
      "ip",
      "user_agent",
      "metadata",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = rows.map((r) =>
      [
        r.created_at,
        r.action,
        r.actor?.email ?? "",
        r.actor_user_id,
        r.target_user?.email ?? "",
        r.target_user_id ?? "",
        r.target_condominio_id ?? "",
        r.target_kb_id ?? "",
        r.ip_address ?? "",
        r.user_agent ?? "",
        JSON.stringify(r.metadata ?? {}),
      ]
        .map(escape)
        .join(","),
    );
    const csv = [header.map(escape).join(","), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Auditoria</h1>
        <p className="text-muted-foreground">
          Ações administrativas com captura de IP e User Agent, para conformidade LGPD.
        </p>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Card className="p-4 mb-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Buscar (IP ou metadata)</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex.: 187. ou email" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Ação</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm min-w-[160px]"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">Todas</option>
              {actionsDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Período</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={sinceDays}
              onChange={(e) => setSinceDays(Number(e.target.value))}
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={365}>Último ano</option>
            </select>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </Card>

        <Card className="divide-y divide-[var(--landing-rule)] text-xs">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {loading ? "Carregando…" : "Sem registros para os filtros atuais."}
            </p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-accent/10 text-accent px-2 py-0.5 font-mono">
                    {r.action}
                  </span>
                  <span>
                    por{" "}
                    <strong className="text-primary">
                      {r.actor?.nome || r.actor?.email || r.actor_user_id.slice(0, 8)}
                    </strong>
                    {r.actor?.email && r.actor?.nome && (
                      <span className="text-muted-foreground"> ({r.actor.email})</span>
                    )}
                  </span>
                  {r.target_user_id && (
                    <span className="text-muted-foreground">
                      → alvo{" "}
                      {r.target_user?.email || r.target_user_id.slice(0, 8)}
                    </span>
                  )}
                  {r.target_kb_id && (
                    <span className="text-muted-foreground">→ KB {r.target_kb_id.slice(0, 8)}</span>
                  )}
                  {r.target_condominio_id && (
                    <span className="text-muted-foreground">
                      → condomínio {r.target_condominio_id.slice(0, 8)}
                    </span>
                  )}
                  {r.ip_address && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                      IP {r.ip_address}
                    </span>
                  )}
                </div>
                {Object.keys(r.metadata || {}).length > 0 && (
                  <pre className="text-muted-foreground whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(r.metadata)}
                  </pre>
                )}
                {r.user_agent && (
                  <p className="text-muted-foreground truncate font-mono" title={r.user_agent}>
                    UA: {r.user_agent}
                  </p>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}