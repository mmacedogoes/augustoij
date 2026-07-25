import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContratosTabs({ condominioId }: { condominioId: string | null }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = condominioId ? `?cid=${encodeURIComponent(condominioId)}` : "";
  const items: Array<{ to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
    {
      to: `/app/contratos/painel${search}`,
      label: "Painel",
      icon: LayoutDashboard,
      match: (p) => p.startsWith("/app/contratos/painel"),
    },
    {
      // Cobre também /novo, /importar, /$id e /$id/editar — a aba "Contratos"
      // permanece ativa em qualquer subrota que não seja o painel.
      to: `/app/contratos${search}`,
      label: "Contratos",
      icon: FileText,
      match: (p) =>
        p === "/app/contratos" ||
        (p.startsWith("/app/contratos/") && !p.startsWith("/app/contratos/painel")),
    },
  ];
  return (
    <nav
      aria-label="Navegação de Gestão de Contratos"
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 shadow-[0_1px_0_hsl(0_0%_100%/0.6)_inset] backdrop-blur-sm"
    >
      {items.map((it) => {
        const active = it.match(pathname);
        const Icon = it.icon;
        return (
          <Link
            key={it.label}
            to={it.to as "/app/contratos"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              active
                ? "bg-background text-primary shadow-sm ring-1 ring-augusto-gold/25"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}