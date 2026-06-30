import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Augusto.IJ" },
      { name: "description", content: "Acesse sua conta do Augusto.IJ." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex justify-center mb-8">
          <Logo variant="default" height={300} />
        </Link>
        <h1 className="text-3xl font-serif font-medium text-foreground tracking-tight text-center">Bem-vindo</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">Entre para conversar com o Augusto.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta? <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}