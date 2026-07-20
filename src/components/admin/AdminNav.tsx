import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Users, Building2, GraduationCap, Megaphone, History, DollarSign, Newspaper, Activity, Home, MapPin, LifeBuoy } from "lucide-react";
import { countAlertasPendentes } from "@/lib/admin-uso.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { countCidadesNovasPendentes } from "@/lib/cidades-novas.functions";
import { adminCountAbertos as countHelpdeskAbertos } from "@/lib/helpdesk.functions";

type AdminNavItem = {
  to:
    | "/app/admin"
    | "/app/admin/usuarios"
    | "/app/admin/condominios"
    | "/app/admin/financeiro"
    | "/app/admin/uso"
    | "/app/admin/blog"
    | "/app/admin/treinamento"
    | "/app/admin/orientacoes"
    | "/app/admin/auditoria"
    | "/app/admin/cidades-novas"
    | "/app/admin/imoveis"
    | "/app/admin/helpdesk";
  label: string;
  icon: typeof BarChart3;
  exact?: boolean;
  superAdminOnly?: boolean;
};

const items: AdminNavItem[] = [
  { to: "/app/admin", label: "Visão geral", icon: BarChart3, exact: true },
  { to: "/app/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/app/admin/condominios", label: "Condomínios", icon: Building2 },
  { to: "/app/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/app/admin/uso", label: "Uso & Custos", icon: Activity },
  { to: "/app/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/app/admin/treinamento", label: "Treinar IA", icon: GraduationCap },
  { to: "/app/admin/orientacoes", label: "Orientações", icon: Megaphone },
  { to: "/app/admin/auditoria", label: "Auditoria", icon: History },
  { to: "/app/admin/cidades-novas", label: "Cidades novas", icon: MapPin, superAdminOnly: true },
  { to: "/app/admin/imoveis", label: "Administração de Imóveis", icon: Home, superAdminOnly: true },
  { to: "/app/admin/helpdesk", label: "Helpdesk", icon: LifeBuoy },
];

export function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const countFn = useServerFn(countAlertasPendentes);
  const countCidadesFn = useServerFn(countCidadesNovasPendentes);
  const adminInfoFn = useServerFn(isCurrentUserAdmin);
  const countHelpdeskFn = useServerFn(countHelpdeskAbertos);
  const [alertas, setAlertas] = useState(0);
  const [cidadesNovas, setCidadesNovas] = useState(0);
  const [helpdeskAbertos, setHelpdeskAbertos] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    countFn({ data: undefined as never })
      .then((r) => setAlertas(r.count))
      .catch(() => {});
    countCidadesFn()
      .then((r) => setCidadesNovas(r.count))
      .catch(() => {});
    adminInfoFn().then((r) => setIsSuperAdmin(r?.papel === "super_admin")).catch(() => {});
    countHelpdeskFn().then((r: { count: number }) => setHelpdeskAbertos(r.count)).catch(() => {});
  }, [countFn, countCidadesFn, adminInfoFn, countHelpdeskFn]);
  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-3 mb-6">
      {items.filter((i) => !i.superAdminOnly || isSuperAdmin).map((i) => {
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
            {i.to === "/app/admin/uso" && alertas > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5 min-w-[18px]">
                {alertas}
              </span>
            ) : null}
            {i.to === "/app/admin/cidades-novas" && cidadesNovas > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 min-w-[18px]">
                {cidadesNovas}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}