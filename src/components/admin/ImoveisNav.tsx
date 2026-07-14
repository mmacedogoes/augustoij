import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Building, FileText, Briefcase } from "lucide-react";

type Item = {
  to:
    | "/app/admin/imoveis"
    | "/app/admin/imoveis/proprietarios"
    | "/app/admin/imoveis/unidades"
    | "/app/admin/imoveis/locacao"
    | "/app/admin/imoveis/administracao";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const items: Item[] = [
  { to: "/app/admin/imoveis", label: "Visão geral", icon: Home, exact: true },
  { to: "/app/admin/imoveis/proprietarios", label: "Proprietários", icon: Users },
  { to: "/app/admin/imoveis/unidades", label: "Imóveis", icon: Building },
  { to: "/app/admin/imoveis/locacao", label: "Contratos de locação", icon: FileText },
  { to: "/app/admin/imoveis/administracao", label: "Contratos de administração", icon: Briefcase },
];

export function ImoveisNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3 mb-6">
      {items.map((i) => {
        const active = i.exact ? pathname === i.to : pathname.startsWith(i.to);
        return (
          <Link
            key={i.to}
            to={i.to}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-primary hover:bg-muted"
            }`}
          >
            <i.icon className="h-4 w-4" strokeWidth={1.5} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}