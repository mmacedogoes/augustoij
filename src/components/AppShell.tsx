import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building, User, LogOut, Shield, FileText } from "lucide-react";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { getProfile } from "@/lib/condominios.functions";
import { OnboardingTour } from "@/components/OnboardingTour";
import { DicasPopup } from "@/components/DicasPopup";
import { HelpMenu } from "@/components/HelpMenu";
import { NotificationsBell } from "@/components/contratos-servico/NotificationsBell";
import { TrialExpiredBanner } from "@/components/gates/PlanGates";
import { UsageThresholdBanner } from "@/components/gates/UsageThresholdBanner";
import { useState, createContext, useContext } from "react";

// Marca que já existe um AppShell montado acima na árvore (layout /app).
// Páginas que ainda usam <AppShell> continuam funcionando: nesse caso o
// componente apenas repassa o conteúdo, sem duplicar menu/cabeçalho.
const AppShellContext = createContext(false);

const baseNav = [
  { to: "/app", label: "Início", icon: LayoutDashboard, tour: "nav-dashboard" },
  { to: "/app/condominios", label: "Condomínios", icon: Building, tour: "nav-condominios" },
  { to: "/app/conta", label: "Conta", icon: User, tour: "nav-conta" },
] as const;

const contratosNav = { to: "/app/contratos/painel", label: "Gestão de Contratos", icon: FileText, tour: "nav-contratos" } as const;
const adminNav = { to: "/app/admin", label: "Admin", icon: Shield, tour: "nav-admin" } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const jaMontado = useContext(AppShellContext);
  if (jaMontado) return <>{children}</>;
  return <AppShellRoot>{children}</AppShellRoot>;
}

function AppShellRoot({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const fetchProfile = useServerFn(getProfile);
  const [forceTour, setForceTour] = useState(false);

  // Um único fetch em paralelo, cacheado por 5min entre trocas de rota.
  const { data: shellData } = useQuery({
    queryKey: ["app-shell-bootstrap"],
    queryFn: async () => {
      const [admin, prof] = await Promise.all([
        checkAdmin().catch(() => null),
        fetchProfile().catch(() => null),
      ]);
      return {
        isAdmin: !!admin?.admin,
        profile: (prof as {
          id: string;
          perfil_atuacao?: string | null;
          onboarding_tour_completo?: boolean | null;
          dicas_ativas?: boolean | null;
        } | null) ?? null,
      };
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const isAdmin = shellData?.isAdmin ?? false;
  const profile = shellData?.profile ?? null;

  // "Gestão de Contratos" liberado a qualquer usuário autenticado
  // (RLS filtra por dono do condomínio). Admin ganha acesso extra ao painel /admin.
  const nav = useMemo(
    () =>
      isAdmin
        ? ([...baseNav, contratosNav, adminNav] as ReadonlyArray<
            typeof baseNav[number] | typeof contratosNav | typeof adminNav
          >)
        : ([...baseNav, contratosNav] as ReadonlyArray<
            typeof baseNav[number] | typeof contratosNav
          >),
    [isAdmin],
  );

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login", replace: true });
  }

  return (
    <AppShellContext.Provider value={true}>
    <div className="min-h-screen bg-background">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 bg-sidebar text-sidebar-foreground flex-col overflow-hidden border-r border-sidebar-border/60">
        <Link
          to="/app"
          className="p-5 border-b border-sidebar-border/40 flex items-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/60 rounded-none transition-opacity hover:opacity-90"
        >
          <AugustoLogo variant="horizontal" theme="dark" size={180} />
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to as "/app"}
                data-tour={n.tour}
                className={`group relative flex items-center gap-3 rounded-md pl-4 pr-3 py-2.5 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 focus-visible:ring-offset-0 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/85 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-augusto-gold transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                  }`}
                />
                <n.icon
                  className={`h-4 w-4 transition-colors duration-200 ${active ? "text-augusto-gold" : "text-sidebar-foreground/70 group-hover:text-augusto-gold/80"}`}
                  strokeWidth={1.6}
                />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleSignOut}
          className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.6} /> Sair
        </button>
      </aside>

      <header className="md:hidden border-b border-border bg-card sticky top-0 z-40 shadow-[0_1px_0_0_var(--landing-rule)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center">
            <AugustoLogo variant="horizontal" theme="light" size={140} />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <HelpMenu onStartTour={() => setForceTour(true)} />
            <button
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 px-2 py-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="flex border-t border-border overflow-x-auto">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to as "/app"}
                data-tour={n.tour}
                className={`flex-1 min-w-[88px] px-3 py-2.5 text-xs text-center transition-colors duration-200 border-b-2 ${
                  active
                    ? "text-augusto-green font-semibold border-augusto-gold"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="md:ml-60 flex flex-col min-h-screen">
        <TrialExpiredBanner />
        <UsageThresholdBanner />
        <div className="hidden md:flex h-12 items-center justify-end gap-1 border-b border-border/70 bg-card/70 backdrop-blur-sm px-4 sticky top-0 z-30">
          <NotificationsBell />
          <HelpMenu onStartTour={() => setForceTour(true)} />
        </div>
        <main className="p-4 md:p-8 lg:p-10 flex-1">{children}</main>
      </div>

      {profile && (!profile.onboarding_tour_completo || forceTour) && (
        <OnboardingTour
          perfil={(profile.perfil_atuacao as never) ?? null}
          forceRun={forceTour}
          onClose={() => {
            setForceTour(false);
            // Marca o tour como concluído no cache do query (evita reabrir).
            queryClient.setQueryData<{ isAdmin: boolean; profile: typeof profile } | undefined>(
              ["app-shell-bootstrap"],
              (prev) =>
                prev
                  ? { ...prev, profile: prev.profile ? { ...prev.profile, onboarding_tour_completo: true } : prev.profile }
                  : prev,
            );
          }}
        />
      )}

      {profile && pathname === "/app" && (
        <DicasPopup userId={profile.id} enabled={profile.dicas_ativas !== false} />
      )}
    </div>
    </AppShellContext.Provider>
  );
}