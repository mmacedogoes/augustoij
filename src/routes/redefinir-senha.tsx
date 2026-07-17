import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Augusto.IJ" },
      { name: "description", content: "Crie uma nova senha para sua conta Augusto.IJ." },
    ],
  }),
  component: RedefinirSenhaPage,
});

const schema = z
  .object({
    senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(72),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, { path: ["confirmar"], message: "As senhas não coincidem" });

type Estado = "verificando" | "pronto" | "invalido" | "sucesso";

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Supabase JS detecta o hash de recovery automaticamente e dispara
    // PASSWORD_RECOVERY ou define uma sessão temporária.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setEstado("pronto");
      }
    });

    // Fallback: se em 1.5s não houver sessão, considerar link inválido/expirado.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      setEstado((prev) => (prev === "verificando" ? (data.session ? "pronto" : "invalido") : prev));
    }, 1500);

    // Detecta erros no hash (ex.: otp_expired).
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("error")) {
        setEstado("invalido");
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (estado !== "sucesso") return;
    const t = setTimeout(() => {
      supabase.auth.signOut().finally(() => navigate({ to: "/login" }));
    }, 3500);
    return () => clearTimeout(t);
  }, [estado, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ senha, confirmar });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.senha });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("session") || msg.includes("expired") || msg.includes("token")) {
        setEstado("invalido");
        return;
      }
      if (msg.includes("pwned") || msg.includes("weak")) {
        toast.error("Essa senha aparece em vazamentos públicos. Escolha uma senha diferente.");
        return;
      }
      toast.error(error.message);
      return;
    }
    setEstado("sucesso");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex justify-center mb-8">
          <AugustoLogo variant="stacked" theme="light" size={220} showTagline />
        </Link>

        {estado === "verificando" && (
          <p className="text-center text-sm text-muted-foreground">Validando link de redefinição...</p>
        )}

        {estado === "invalido" && (
          <div className="text-center space-y-6">
            <h1 className="text-2xl font-serif font-medium text-foreground tracking-tight">
              Link inválido ou expirado
            </h1>
            <p className="text-sm text-muted-foreground">
              O link de redefinição expirou ou já foi utilizado. Solicite um novo para continuar.
            </p>
            <Link to="/esqueci-senha">
              <Button className="w-full">Solicitar novo link</Button>
            </Link>
          </div>
        )}

        {estado === "sucesso" && (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-serif font-medium text-foreground tracking-tight">
              Senha redefinida com sucesso
            </h1>
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para o login em instantes para entrar com a nova senha.
            </p>
            <Link to="/login" className="text-primary font-medium hover:underline text-sm inline-block">
              Ir para o login agora
            </Link>
          </div>
        )}

        {estado === "pronto" && (
          <>
            <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight text-center">
              Criar nova senha
            </h1>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Escolha uma senha com pelo menos 8 caracteres.
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="senha" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Nova senha
                </Label>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirmar"
                  className="text-xs font-medium tracking-wide uppercase text-muted-foreground"
                >
                  Confirmar nova senha
                </Label>
                <Input
                  id="confirmar"
                  type="password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}