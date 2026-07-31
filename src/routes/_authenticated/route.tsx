import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type AcessoCache = { userId: string; onboarding_completo: boolean; papel_sistema: string | null };

let cacheAcesso: AcessoCache | null = null;

/** Limpa o cache de roteamento (logout, conclusão de onboarding). */
export function limparCacheAcesso() {
  cacheAcesso = null;
}

supabase.auth.onAuthStateChange(() => {
  cacheAcesso = null;
});

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession lê o token local: sem round-trip a cada clique no menu.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw redirect({ to: "/login" });

    let profile: { onboarding_completo: boolean | null; papel_sistema: string | null } | null = null;
    if (cacheAcesso && cacheAcesso.userId === user.id) {
      profile = {
        onboarding_completo: cacheAcesso.onboarding_completo,
        papel_sistema: cacheAcesso.papel_sistema,
      };
    } else {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completo, papel_sistema")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        profile = data;
        if (data) {
          cacheAcesso = {
            userId: user.id,
            onboarding_completo: !!data.onboarding_completo,
            papel_sistema: data.papel_sistema ?? null,
          };
        }
      } catch {
        // Rede caindo: não derruba a navegação; o RLS continua protegendo os dados.
        profile = null;
      }
    }

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

    return { user, papel: profile?.papel_sistema ?? null };
  },
  component: () => <Outlet />,
});