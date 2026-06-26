import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Users, Building2, GraduationCap, Megaphone, History } from "lucide-react";

type AdminNavItem = {
  to: string;
  label: string;
  icon: typeof BarChart3;
  exact?: boolean;
};

const items: AdminNavItem[] = [
  { to: "/app/admin", label: "Visão geral", icon: BarChart3, exact: true },
  { to: "/app/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/app/admin/condominios", label: "Condomínios", icon: Building2 },
  { to: "/app/admin/treinamento", label: "Treinar IA", icon: GraduationCap },
  { to: "/app/admin/orientacoes", label: "Orientações", icon: Megaphone },
  { to: "/app/admin/auditoria", label: "Auditoria", icon: History },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3 mb-6">
      {items.map((i) => {
        const active = i.exact ? pathname === i.to : pathname.startsWith(i.to);
        return (
          <Link
            key={i.to}
            to={i.to as "/app/admin"}
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