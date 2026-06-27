import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building, User, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isCurrentUserAdmin } from "@/lib/admin.functions";

const baseNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/condominios", label: "Condomínios", icon: Building },
  { to: "/app/conta", label: "Conta", icon: User },
] as const;

const adminNav = { to: "/app/admin", label: "Admin", icon: Shield } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin().then((r) => setIsAdmin(!!r?.admin)).catch(() => setIsAdmin(false));
  }, [checkAdmin]);

  const nav = isAdmin ? ([...baseNav, adminNav] as ReadonlyArray<typeof baseNav[number] | typeof adminNav>) : baseNav;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-sidebar text-sidebar-foreground flex-col">
        <div className="p-6">
          <Logo variant="inverted" height={150} />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to as "/app"} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"}`}>
                <n.icon className="h-4 w-4" strokeWidth={1.5} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={handleSignOut} className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors">
          <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sair
        </button>
      </aside>

      <header className="md:hidden border-b border-border bg-card sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center">
            <Logo variant="default" size="sm" />
          </Link>
          <button onClick={handleSignOut} className="text-sm text-muted-foreground">Sair</button>
        </div>
        <nav className="flex border-t border-border overflow-x-auto">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to as "/app"} className={`flex-1 px-3 py-2 text-xs text-center ${active ? "text-primary font-medium border-b-2 border-primary" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="md:ml-60 p-4 md:p-8">{children}</main>
    </div>
  );
}