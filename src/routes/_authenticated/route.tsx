import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Mostra um skeleton logo (200ms) em vez de tela branca durante navegações.
  pendingMs: 200,
  pendingComponent: () => (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-56 rounded-md bg-muted/60 animate-pulse" />
        <div className="h-4 w-80 rounded-md bg-muted/40 animate-pulse" />
        <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
          <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      </div>
    </div>
  ),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    // Onboarding gate
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completo, papel_sistema")
      .eq("id", data.user.id)
      .maybeSingle();

    const onOnboarding = location.pathname.startsWith("/onboarding");
    // Pré-onboarding: usuário recém-confirmado que escolheu um plano pago
    // precisa concluir o checkout antes de fazer o onboarding.
    const onAssinatura = location.pathname.startsWith("/app/assinatura");
    const isInternalAdmin = profile?.papel_sistema === "super_admin"
      || profile?.papel_sistema === "admin_operacional"
      || profile?.papel_sistema === "admin_suporte";

    if (profile && !profile.onboarding_completo && !onOnboarding && !onAssinatura && !isInternalAdmin) {
      throw redirect({ to: "/onboarding" });
    }
    if (profile?.onboarding_completo && onOnboarding) {
      throw redirect({ to: "/app" });
    }

    return { user: data.user, papel: profile?.papel_sistema ?? null };
  },
  component: () => <Outlet />,
});