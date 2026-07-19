import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
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