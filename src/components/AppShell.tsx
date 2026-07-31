import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building,
  User,
  LogOut,
  Shield,
  FileText,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useMemo, useEffect } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

type NavItem = { to: string; label: string; icon: typeof Building; tour: string };

const COLLAPSE_KEY = "augusto.sidebarRecolhida";

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
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhida, setRecolhida] = useState(false);

  // Preferência de sidebar recolhida (lida depois da hidratação).
  useEffect(() => {
    try {
      setRecolhida(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage indisponível — mantém expandida */
    }
  }, []);

  function alternarRecolhida() {
    setRecolhida((v) => {
      const proximo = !v;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, proximo ? "1" : "0");
      } catch {
        /* ignora */
      }
      return proximo;
    });
  }

  // Fecha o drawer ao trocar de rota.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

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
  const nav = useMemo<ReadonlyArray<NavItem>>(
    () =>
      (isAdmin ? [...baseNav, contratosNav, adminNav] : [...baseNav, contratosNav]) as NavItem[],
    [isAdmin],
  );

  const ehAtivo = (to: string) => pathname === to || (to !== "/app" && pathname.startsWith(to));
  const tituloAtual = useMemo(() => {
    const item = [...nav].reverse().find((n) => ehAtivo(n.to));
    return item?.label ?? "Início";
  }, [nav, pathname]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/login", replace: true });
  }

  function NavList({ compacto }: { compacto: boolean }) {
    return (
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((n) => {
          const active = ehAtivo(n.to);
          const link = (
            <Link
              key={n.to}
              to={n.to as "/app"}
              data-tour={n.tour}
              aria-current={active ? "page" : undefined}
              className={cn(
                "app-nav-item group",
                active && "app-nav-item-active",
                compacto && "justify-center px-0 pl-0",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("app-rail", active ? "opacity-100" : "opacity-0 group-hover:opacity-60")}
              />
              <n.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-200",
                  active ? "text-augusto-gold" : "text-sidebar-foreground/70 group-hover:text-augusto-gold/80",
                )}
                strokeWidth={1.6}
              />
              {!compacto && <span className="truncate">{n.label}</span>}
            </Link>
          );
          if (!compacto) return link;
          return (
            <Tooltip key={n.to} delayDuration={120}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{n.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    );
  }

  function SidebarInner({ compacto }: { compacto: boolean }) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
        <Link
          to="/app"
          className={cn(
            "flex items-center overflow-hidden border-b border-sidebar-border/40 transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/60",
            compacto ? "justify-center p-4" : "p-5",
          )}
          aria-label="Ir para o início"
        >
          <AugustoLogo variant={compacto ? "icon" : "horizontal"} theme="dark" size={compacto ? 32 : 180} />
        </Link>

        <NavList compacto={compacto} />

        <div className="space-y-1 border-t border-sidebar-border/40 p-3">
          <button
            onClick={handleSignOut}
            className={cn("app-nav-item w-full", compacto && "justify-center px-0 pl-0")}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.6} />
            {!compacto && <span>Sair</span>}
          </button>
          <button
            onClick={alternarRecolhida}
            className={cn("app-nav-item hidden w-full md:flex", compacto && "justify-center px-0 pl-0")}
            aria-label={compacto ? "Expandir menu" : "Recolher menu"}
          >
            {compacto ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" strokeWidth={1.6} />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShellContext.Provider value={true}>
      <TooltipProvider>
        <div
          className="app-surface min-h-screen"
          style={
            {
              "--app-shell-w": recolhida ? "var(--app-sidebar-w-collapsed)" : "var(--app-sidebar-w)",
            } as React.CSSProperties
          }
        >
          {/* Sidebar desktop */}
          <aside
            className="fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border/60 md:block"
            style={{
              width: "var(--app-shell-w)",
              transition: "width var(--app-dur-slow) var(--app-ease)",
            }}
          >
            <SidebarInner compacto={recolhida} />
          </aside>

          {/* Drawer mobile */}
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetContent side="left" className="w-[17rem] border-sidebar-border/60 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarInner compacto={false} />
            </SheetContent>
          </Sheet>

          <div
            className="flex min-h-screen flex-col"
            style={{ marginLeft: 0, transition: "margin var(--app-dur-slow) var(--app-ease)" }}
          >
            <div className="md:ml-[var(--app-shell-w)] flex min-h-screen flex-col transition-[margin] duration-250 ease-out">
              <TrialExpiredBanner />
              <UsageThresholdBanner />

              <header className="app-topbar sticky top-0 z-30 flex h-14 items-center gap-3 px-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setMenuAberto(true)}
                  aria-label="Abrir menu"
                  className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 active:scale-95 md:hidden"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.6} />
                </button>

                <Link to="/app" className="flex items-center md:hidden" aria-label="Início">
                  <AugustoLogo variant="horizontal" theme="light" size={124} />
                </Link>

                <span className="hidden min-w-0 truncate font-serif text-[17px] leading-none text-augusto-green md:block">
                  {tituloAtual}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <NotificationsBell />
                  <HelpMenu onStartTour={() => setForceTour(true)} />
                </div>
              </header>

              <main className="app-enter flex-1 p-4 sm:p-6 md:p-8 lg:p-10">{children}</main>
            </div>
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
      </TooltipProvider>
    </AppShellContext.Provider>
  );
}
