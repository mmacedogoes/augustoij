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
  MoreHorizontal,
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

  // Identidade do usuário — usa somente campos já retornados por getProfile.
  const identidade = useMemo(() => {
    const p = profile as ({ nome?: string | null; email?: string | null; perfil_atuacao?: string | null } | null);
    if (!p) return null;
    const nome = (p.nome ?? "").trim();
    const email = (p.email ?? "").trim();
    const base = nome || email;
    if (!base) return null;
    const iniciais = (nome ? nome.split(/\s+/) : [email])
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("");
    return { iniciais: iniciais || base[0].toUpperCase(), nome: nome || email, perfil: p.perfil_atuacao ?? null };
  }, [profile]);

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
            <SidebarInner
              compacto={recolhida}
              nav={nav}
              ehAtivo={ehAtivo}
              onSignOut={handleSignOut}
              onToggle={alternarRecolhida}
              identidade={identidade}
            />
          </aside>

          {/* Drawer mobile */}
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetContent side="left" className="w-[17rem] border-sidebar-border/60 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarInner
                compacto={false}
                nav={nav}
                ehAtivo={ehAtivo}
                onSignOut={handleSignOut}
                onToggle={alternarRecolhida}
                identidade={identidade}
              />
            </SheetContent>
          </Sheet>

          <div
            className="flex min-h-screen flex-col md:ml-[var(--app-shell-w)]"
            style={{ transition: "margin var(--app-dur-slow) var(--app-ease)" }}
          >
            <TrialExpiredBanner />
              <UsageThresholdBanner />

              <header
                className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--landing-rule)] bg-background/80 px-3 backdrop-blur-[12px] sm:px-4"
              >
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

                <span className="app-eyebrow hidden min-w-0 truncate md:inline-flex">
                  {tituloAtual}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <NotificationsBell />
                  <HelpMenu onStartTour={() => setForceTour(true)} />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label="Sair"
                    className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 md:hidden"
                  >
                    <LogOut className="h-5 w-5" strokeWidth={1.6} />
                  </button>
                </div>
              </header>

            <main className="flex-1 p-4 pb-[72px] sm:p-6 md:p-8 md:pb-8 lg:p-10 lg:pb-10">
              <div key={pathname} className="app-enter">
                {children}
              </div>
            </main>
          </div>

          <MobileTabBar nav={nav} ehAtivo={ehAtivo} />

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

type SidebarProps = {
  compacto: boolean;
  nav: ReadonlyArray<NavItem>;
  ehAtivo: (to: string) => boolean;
  onSignOut: () => void;
  onToggle: () => void;
  identidade?: { iniciais: string; nome: string; perfil: string | null } | null;
};

function MobileTabBar({
  nav,
  ehAtivo,
}: {
  nav: ReadonlyArray<NavItem>;
  ehAtivo: (to: string) => boolean;
}) {
  const [maisAberto, setMaisAberto] = useState(false);
  const excedente = nav.length > 5;
  const visiveis = excedente ? nav.slice(0, 4) : nav;
  const restantes = excedente ? nav.slice(4) : [];

  const item = (n: NavItem) => {
    const active = ehAtivo(n.to);
    return (
      <Link
        key={n.to}
        to={n.to as "/app"}
        aria-current={active ? "page" : undefined}
        className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
      >
        <span
          aria-hidden="true"
          className="absolute top-0 h-[2px] rounded-full bg-augusto-gold"
          style={{
            width: active ? "16px" : "0px",
            opacity: active ? 1 : 0,
            transition: "width var(--dur-base) var(--ease-out-quint), opacity var(--dur-base) var(--ease-out-quint)",
          }}
        />
        <n.icon
          className={cn("h-5 w-5", active ? "text-augusto-gold" : "text-muted-foreground")}
          strokeWidth={1.6}
        />
        <span className={cn("text-[10px] leading-none", active ? "text-augusto-gold" : "text-muted-foreground")}>
          {n.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-40 flex w-full border-t border-[var(--landing-rule)] bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {visiveis.map(item)}
        {excedente && (
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.6} />
            <span className="text-[10px] leading-none">Mais</span>
          </button>
        )}
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetTitle className="text-base">Mais</SheetTitle>
          <div className="mt-4 grid gap-1">
            {restantes.map((n) => (
              <Link
                key={n.to}
                to={n.to as "/app"}
                onClick={() => setMaisAberto(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-foreground transition-colors duration-[var(--dur-fast)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70"
              >
                <n.icon className="h-4 w-4 text-augusto-gold" strokeWidth={1.6} />
                {n.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

type SidebarPropsUnused = {
  compacto: boolean;
  nav: ReadonlyArray<NavItem>;
  ehAtivo: (to: string) => boolean;
  onSignOut: () => void;
  onToggle: () => void;
  identidade?: { iniciais: string; nome: string; perfil: string | null } | null;
};

function SidebarInner({ compacto, nav, ehAtivo, onSignOut, onToggle, identidade }: SidebarProps) {
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
        <AugustoLogo variant={compacto ? "icon-only" : "horizontal"} theme="dark" size={compacto ? 32 : 180} />
      </Link>

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
                style={{
                  height: active ? "20px" : "0px",
                  transition:
                    "height var(--dur-base) var(--ease-out-quint), opacity var(--dur-base) var(--ease-out-quint)",
                }}
              />
              <n.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-soft)]",
                  active
                    ? "text-augusto-gold"
                    : "text-sidebar-foreground/70 group-hover:translate-x-0.5 group-hover:text-augusto-gold/80",
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

      <div className="space-y-1 border-t border-sidebar-border/40 p-3">
        {identidade && (
          <div
            className={cn(
              "mb-2 flex items-center gap-3 rounded-lg px-2 py-2",
              compacto && "justify-center px-0",
            )}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-augusto-gold"
              style={{ background: "color-mix(in hsl, var(--augusto-gold) 16%, transparent)" }}
            >
              {identidade.iniciais}
            </span>
            {!compacto && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] text-sidebar-foreground">{identidade.nome}</span>
                {identidade.perfil && (
                  <span className="block truncate text-[11px] text-sidebar-foreground/60">
                    {identidade.perfil}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        <button
          onClick={onSignOut}
          className={cn("app-nav-item w-full", compacto && "justify-center px-0 pl-0")}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          {!compacto && <span>Sair</span>}
        </button>
        <button
          onClick={onToggle}
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
