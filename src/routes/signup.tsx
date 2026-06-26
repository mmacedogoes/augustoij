import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Criar conta — CondoIA" },
      { name: "description", content: "Crie sua conta no CondoIA e teste grátis por 7 dias." },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Senha precisa de no mínimo 8 caracteres").max(72),
  oab: z.string().trim().max(20).optional(),
  lgpd: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar os termos e a política de privacidade." }) }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", email: "", password: "", oab: "" });
  const [lgpd, setLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ ...form, lgpd });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/app` : undefined,
        data: { nome: parsed.data.nome, oab: parsed.data.oab ?? "", lgpd_aceite: true },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Redirecionando...");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="flex justify-center mb-8">
          <Logo variant="default" size="lg" />
        </Link>
        <h1 className="text-3xl font-bold text-primary tracking-tight text-center">Criar conta</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">Teste grátis por 7 dias. Sem cartão.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Nome completo</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Senha</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oab" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">OAB <span className="normal-case tracking-normal">(opcional)</span></Label>
              <Input id="oab" value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} placeholder="Ex: SP 123456" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={lgpd} onCheckedChange={(c) => setLgpd(c === true)} className="mt-0.5" />
              <span className="text-muted-foreground">
                Li e aceito os <Link to="/termos" className="text-primary underline">Termos de uso</Link> e a <Link to="/privacidade" className="text-primary underline">Política de privacidade</Link> (LGPD).
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}