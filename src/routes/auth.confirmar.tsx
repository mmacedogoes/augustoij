import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { registrarAceiteTermos } from "@/lib/privacidade.functions";
import { TERMOS_VERSAO } from "@/config/legal";

export const Route = createFileRoute("/auth/confirmar")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => {
    const planoRaw = typeof s.plano === "string" ? s.plano : "";
    const cicloRaw = typeof s.ciclo === "string" ? s.ciclo : "";
    const planosPagos = ["essencial", "profissional", "gestao", "administradora"] as const;
    const plano = (planosPagos as readonly string[]).includes(planoRaw)
      ? (planoRaw as typeof planosPagos[number])
      : undefined;
    const ciclo = cicloRaw === "anual" ? "anual" : cicloRaw === "mensal" ? "mensal" : undefined;
    return { plano, ciclo };
  },
  head: () => ({
    meta: [
      { title: "Confirmando seu e-mail — Augusto.IJ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ConfirmarPage,
});

function ConfirmarPage() {
  const navigate = useNavigate();
  const registrarAceite = useServerFn(registrarAceiteTermos);
  const search = useSearch({ from: "/auth/confirmar" }) as {
    plano?: "essencial" | "profissional" | "gestao" | "administradora";
    ciclo?: "mensal" | "anual";
  };
  const [state, setState] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Aguarda o Supabase processar o hash do link (#access_token=...) e
      // popular a sessão. `onAuthStateChange` cobre casos onde o processamento
      // é assíncrono.
      const { data } = await supabase.auth.getSession();

      let session = data.session;
      if (!session) {
        await new Promise<void>((resolve) => {
          const sub = supabase.auth.onAuthStateChange((_ev, s) => {
            if (s) {
              session = s;
              sub.data.subscription.unsubscribe();
              window.clearTimeout(timer);
              resolve();
            }
          });
          const timer = window.setTimeout(() => {
            sub.data.subscription.unsubscribe();
            resolve();
          }, 4000);
        });
      }

      if (cancelled) return;

      if (!session) {
        setState("error");
        return;
      }

      // Só agora que o e-mail foi confirmado disparamos boas-vindas, dicas e
      // aceite de termos — evita que o usuário receba welcome antes do
      // link de verificação. Ignora falhas para não travar o fluxo.
      try {
        const raw = window.localStorage.getItem("ij:aceite_pos_confirmacao");
        const parsedAceite = raw
          ? (JSON.parse(raw) as {
              versao?: string;
              marketingOptIn?: boolean;
              nome?: string;
            })
          : null;
        window.localStorage.removeItem("ij:aceite_pos_confirmacao");
        const email = session.user.email ?? "";
        const nome =
          parsedAceite?.nome ||
          (session.user.user_metadata?.nome as string | undefined) ||
          (session.user.user_metadata?.full_name as string | undefined) ||
          email;
        if (parsedAceite) {
          registrarAceite({
            data: {
              versao: parsedAceite.versao ?? TERMOS_VERSAO,
              marketingOptIn: !!parsedAceite.marketingOptIn,
            },
          }).catch((e) => console.warn("[confirmar] aceite falhou", e));
        }
        if (email) {
          supabase.functions
            .invoke("send-welcome-email", { body: { email, nome } })
            .catch((e) => console.warn("[confirmar] welcome falhou", e));
          supabase.functions
            .invoke("send-tips-email", {
              body: { email, nome, delay_hours: 24 },
            })
            .catch((e) => console.warn("[confirmar] tips falhou", e));
        }
      } catch (e) {
        console.warn("[confirmar] pós-confirmação falhou", e);
      }

      // Recupera intenção de plano do search ou do fallback localStorage.
      let plano = search.plano;
      let ciclo = search.ciclo ?? "mensal";
      if (!plano) {
        try {
          const raw = window.localStorage.getItem("ij:plano_pos_confirmacao");
          if (raw) {
            const parsed = JSON.parse(raw) as {
              plano?: typeof plano;
              ciclo?: typeof ciclo;
            };
            plano = parsed.plano;
            ciclo = parsed.ciclo ?? "mensal";
          }
        } catch {
          /* ignore */
        }
      }
      try {
        window.localStorage.removeItem("ij:plano_pos_confirmacao");
      } catch {
        /* ignore */
      }

      setState("ok");

      // Pequeno delay para o usuário ver o feedback de sucesso.
      window.setTimeout(() => {
        if (plano) {
          navigate({
            to: "/app/assinatura",
            search: { plano, ciclo },
          });
        } else {
          navigate({ to: "/app" });
        }
      }, 800);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, search.plano, search.ciclo]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8">
        <AugustoLogo variant="stacked" theme="light" size={200} showTagline />
      </Link>
      <div className="w-full max-w-[440px] rounded-xl border border-border bg-card text-card-foreground p-10 shadow-sm text-center">
        {state === "checking" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Confirmando seu e-mail…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Aguarde um instante enquanto ativamos sua conta.
            </p>
          </>
        )}
        {state === "ok" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">E-mail confirmado!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Redirecionando você{search.plano ? " para o pagamento" : " para o painel"}…
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Não foi possível confirmar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O link pode ter expirado ou já foi utilizado. Faça login para continuar.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/login" })}>
              Ir para o login
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default ConfirmarPage;