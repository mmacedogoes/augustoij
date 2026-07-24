import { Link, useRouterState } from "@tanstack/react-router";

export function ContratosTabs({ condominioId }: { condominioId: string | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = condominioId ? `?cid=${encodeURIComponent(condominioId)}` : "";
  const items: Array<{ to: string; label: string; match: (p: string) => boolean }> = [
    { to: `/app/contratos/painel${search}`, label: "Painel", match: (p) => p.startsWith("/app/contratos/painel") },
    { to: `/app/contratos${search}`, label: "Contratos", match: (p) => p === "/app/contratos" || (p.startsWith("/app/contratos") && !p.startsWith("/app/contratos/painel") && !p.startsWith("/app/contratos/novo") && !p.startsWith("/app/contratos/importar")) },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.label}
            to={it.to as "/app/contratos"}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}