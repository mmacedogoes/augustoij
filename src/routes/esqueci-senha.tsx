import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { toast } from "sonner";

export const Route = createFileRoute("/esqueci-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Esqueci minha senha — Augusto.IJ" },
      { name: "description", content: "Recupere o acesso à sua conta Augusto.IJ." },
    ],
  }),
  component: EsqueciSenhaPage,
});

const schema = z.object({ email: z.string().trim().email("E-mail inválido").max(255) });

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/redefinir-senha`
        : "https://augustoij.com.br/redefinir-senha";
    // Ignoramos o erro para não revelar quais e-mails existem na base.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    setLoading(false);
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex justify-center mb-8">
          <AugustoLogo variant="stacked" theme="light" size={220} showTagline />
        </Link>
        <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight text-center">
          Esqueci minha senha
        </h1>
        {enviado ? (
          <div className="mt-8 space-y-6 text-center">
            <p className="text-sm text-muted-foreground">
              Se esse e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.
            </p>
            <p className="text-xs text-muted-foreground">
              Verifique também a caixa de spam. O link expira em alguns minutos.
            </p>
            <Link to="/login" className="text-primary font-medium hover:underline text-sm inline-block">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Informe seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Lembrou a senha?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}