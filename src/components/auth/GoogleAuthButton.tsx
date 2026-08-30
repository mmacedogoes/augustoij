import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  label?: string;
  redirectTo?: string;
  remember?: boolean;
  onNewUser?: (info: { email: string; nome: string }) => void;
};

/**
 * Botão oficial "Continuar com Google" (fundo branco, logo colorido, texto escuro).
 * Usa a autenticação Google GERENCIADA pelo Lovable Cloud — sem credenciais próprias.
 */
export function GoogleAuthButton({ label = "Continuar com Google", redirectTo = "/app", remember = true, onNewUser }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
      });

      if (result.redirected) {
        // Fluxo full-page — o navegador vai redirecionar. Não faz mais nada.
        return;
      }

      if (result.error) {
        const msg = String(result.error.message || "").toLowerCase();
        if (msg.includes("cancel") || msg.includes("closed") || msg.includes("popup") || msg.includes("denied")) {
          toast.error("Login com Google cancelado.");
        } else {
          toast.error("Não foi possível entrar com o Google. Tente novamente ou use seu e-mail e senha.");
        }
        return;
      }

      // Popup mode: sessão já foi definida. Detecta primeiro login para disparar boas-vindas.
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (user) {
        // Aplica preferência de "manter conectado" após sessão estabelecida.
        try {
          const { setRememberMe } = await import("@/lib/remember-session");
          setRememberMe(remember);
        } catch { /* ignore */ }
        const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
        const isBrandNew = createdAt > 0 && Math.abs(lastSignIn - createdAt) < 60_000;
        const nome =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          user.email ||
          "";
        if (isBrandNew && user.email) {
          onNewUser?.({ email: user.email, nome });
          try {
            supabase.functions
              .invoke("send-welcome-email", { body: { email: user.email, nome } })
              .catch((e) => console.warn("[google-auth] falha send-welcome-email", e));
          } catch (e) {
            console.warn("[google-auth] exceção send-welcome-email", e);
          }
          try {
            supabase.functions
              .invoke("send-tips-email", { body: { email: user.email, nome, delay_hours: 24 } })
              .catch((e) => console.warn("[google-auth] falha send-tips-email", e));
          } catch (e) {
            console.warn("[google-auth] exceção send-tips-email", e);
          }
          toast.success("Conta criada! Bem-vindo(a).");
        } else {
          toast.success("Bem-vindo(a) de volta!");
        }
      }

      // `redirectTo` pode ser um caminho preservado (ex.: consentimento OAuth).
      if (redirectTo.startsWith("/") && redirectTo !== "/app") window.location.assign(redirectTo);
      else navigate({ to: "/app" });

    } catch (err) {
      console.error("[google-auth] erro inesperado", err);
      toast.error("Não foi possível entrar com o Google. Tente novamente ou use seu e-mail e senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-all duration-200 hover:bg-[#f8f9fa] hover:shadow active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <GoogleGIcon />
      <span>{loading ? "Conectando…" : label}</span>
    </button>
  );
}

function GoogleGIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function OrDivider() {
  return (
    <div className="relative my-5 flex items-center">
      <div className="flex-grow border-t border-border" />
      <span className="mx-3 text-xs uppercase tracking-wide text-muted-foreground">ou</span>
      <div className="flex-grow border-t border-border" />
    </div>
  );
}

export { OrDivider };