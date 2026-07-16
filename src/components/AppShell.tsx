import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building, User, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { getProfile } from "@/lib/condominios.functions";
import { OnboardingTour } from "@/components/OnboardingTour";
import { DicasPopup } from "@/components/DicasPopup";
import { HelpMenu } from "@/components/HelpMenu";
import { TrialExpiredBanner } from "@/components/gates/PlanGates";
import { UsageThresholdBanner } from "@/components/gates/UsageThresholdBanner";

const baseNav = [
  { to: "/app", label: "Início", icon: LayoutDashboard, tour: "nav-dashboard" },
  { to: "/app/condominios", label: "Condomínios", icon: Building, tour: "nav-condominios" },
  { to: "/app/conta", label: "Conta", icon: User, tour: "nav-conta" },
] as const;

const adminNav = { to: "/app/admin", label: "Admin", icon: Shield, tour: "nav-admin" } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const fetchProfile = useServerFn(getProfile);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{
    id: string;
    perfil_atuacao?: string | null;
    onboarding_tour_completo?: boolean | null;
    dicas_ativas?: boolean | null;
  } | null>(null);
  const [forceTour, setForceTour] = useState(false);

  useEffect(() => {
    checkAdmin().then((r) => setIsAdmin(!!r?.admin)).catch(() => setIsAdmin(false));
    fetchProfile().then((p) => setProfile((p as typeof profile) ?? null)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-sidebar text-sidebar-foreground flex-col overflow-hidden">
        <Link to="/app" className="p-4 border-b border-sidebar-border/40 flex items-center overflow-hidden">
          <AugustoLogo variant="horizontal" theme="dark" size={180} />
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to as "/app"} data-tour={n.tour} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:text-sidebar-accent-foreground"}`}>
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
            <AugustoLogo variant="horizontal" theme="light" size={140} />
          </Link>
          <div className="flex items-center gap-1">
            <HelpMenu onStartTour={() => setForceTour(true)} />
            <button onClick={handleSignOut} className="text-sm text-muted-foreground px-2">Sair</button>
          </div>
        </div>
        <nav className="flex border-t border-border overflow-x-auto">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to as "/app"} data-tour={n.tour} className={`flex-1 px-3 py-2 text-xs text-center ${active ? "text-primary font-medium border-b-2 border-primary" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="md:ml-60 flex flex-col min-h-screen">
        <TrialExpiredBanner />
        <UsageThresholdBanner />
        <div className="hidden md:flex h-12 items-center justify-end border-b border-border bg-card px-4">
          <HelpMenu onStartTour={() => setForceTour(true)} />
        </div>
        <main className="p-4 md:p-8 flex-1">{children}</main>
      </div>

      {profile && (!profile.onboarding_tour_completo || forceTour) && (
        <OnboardingTour
          perfil={(profile.perfil_atuacao as never) ?? null}
          forceRun={forceTour}
          onClose={() => {
            setForceTour(false);
            setProfile((p) => (p ? { ...p, onboarding_tour_completo: true } : p));
          }}
        />
      )}

      {profile && pathname === "/app" && (
        <DicasPopup userId={profile.id} enabled={profile.dicas_ativas !== false} />
      )}
    </div>
  );
}