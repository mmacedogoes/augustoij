import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
    <div className="min-h-screen bg-secondary/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 font-bold text-primary">
          <Building2 className="h-6 w-6 text-accent" /> <span className="text-xl">CondoIA</span>
        </Link>
        <Card className="p-6">
          <h1 className="text-2xl font-bold text-primary">Criar conta</h1>
          <p className="text-sm text-muted-foreground">Teste grátis por 7 dias. Sem cartão.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oab">OAB <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input id="oab" value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} placeholder="Ex: SP 123456" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={lgpd} onCheckedChange={(c) => setLgpd(c === true)} className="mt-0.5" />
              <span className="text-muted-foreground">
                Li e aceito os <Link to="/termos" className="text-accent underline">Termos de uso</Link> e a <Link to="/privacidade" className="text-accent underline">Política de privacidade</Link> (LGPD).
              </span>
            </label>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-accent font-medium">Entrar</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}