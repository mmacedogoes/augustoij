import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { registrarAceiteTermos } from "@/lib/privacidade.functions";
import { TERMOS_VERSAO } from "@/config/legal";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar conta — Augusto.IJ" },
      { name: "description", content: "Teste grátis por 3 dias o assistente jurídico para condomínios." },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Informe um telefone válido").max(40),
  tipo_pessoa: z.enum(["pf", "pj"]),
  cpf_cnpj: z.string().trim().min(11, "Informe CPF ou CNPJ").max(32),
  razao_social: z.string().trim().max(200).optional(),
  perfil_atuacao: z.enum(["sindico", "advogado", "administradora", "conselheiro", "outro"], {
    errorMap: () => ({ message: "Selecione seu perfil de atuação." }),
  }),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
    .regex(/[0-9]/, "Inclua ao menos um número"),
  confirmar: z.string(),
  lgpd: z.literal(true, { errorMap: () => ({ message: "É necessário aceitar os termos." }) }),
}).refine((d) => d.password === d.confirmar, { path: ["confirmar"], message: "As senhas não coincidem" });

function ReqItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? "text-primary" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {children}
    </li>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    tipo_pessoa: "pf" as "pf" | "pj",
    cpf_cnpj: "",
    razao_social: "",
    perfil_atuacao: "" as "" | "sindico" | "advogado" | "administradora" | "conselheiro" | "outro",
    password: "",
    confirmar: "",
  });
  const [lgpd, setLgpd] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const registrarAceite = useServerFn(registrarAceiteTermos);

  const pwd = form.password;
  const checks = useMemo(
    () => ({
      len: pwd.length >= 8,
      letter: /[A-Za-z]/.test(pwd),
      num: /[0-9]/.test(pwd),
      match: pwd.length > 0 && pwd === form.confirmar,
    }),
    [pwd, form.confirmar],
  );

  function translateAuthError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already"))
      return "E-mail já cadastrado. Tente fazer login.";
    if (m.includes("pwned") || m.includes("known to be weak") || m.includes("easy to guess") || m.includes("data breach"))
      return "Essa senha aparece em vazamentos públicos conhecidos e não pode ser usada. Escolha uma senha única, que você não usa em outros sites.";
    if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("at least")))
      return "Senha fraca. Use ao menos 8 caracteres, com letras e números.";
    if (m.includes("invalid email")) return "E-mail inválido.";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos.";
    if (m.includes("network") || m.includes("fetch")) return "Falha de conexão. Verifique sua internet.";
    return message || "Não foi possível criar a conta. Tente novamente.";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[signup] submit iniciado", { email: form.email, tipo: form.tipo_pessoa });
    setErrors({});

    const parsed = schema.safeParse({ ...form, lgpd });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      console.warn("[signup] validação falhou", fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos do formulário.");
      return;
    }

    setLoading(true);
    try {
      try {
        const rl = await fetch("/api/public/auth-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "signup" }),
        });
        if (rl.status === 429) {
          const body = (await rl.json().catch(() => ({}))) as { message?: string };
          toast.error(body.message ?? "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
          return;
        }
      } catch {
        /* falha de rede no rate limit não bloqueia o fluxo */
      }
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined,
          data: {
            nome: parsed.data.nome,
            telefone: parsed.data.telefone,
            tipo_pessoa: parsed.data.tipo_pessoa,
            cpf_cnpj: parsed.data.cpf_cnpj,
            razao_social: parsed.data.tipo_pessoa === "pj" ? parsed.data.razao_social ?? "" : "",
            perfil_atuacao: parsed.data.perfil_atuacao,
            lgpd_aceite: true,
            marketing_opt_in: marketingOptIn,
            termos_versao: TERMOS_VERSAO,
          },
        },
      });
      console.log("[signup] resposta signUp", { hasUser: !!data?.user, hasSession: !!data?.session, error });

      if (error) {
        const friendly = translateAuthError(error.message);
        toast.error(friendly);
        if (/email/i.test(error.message)) setErrors((prev) => ({ ...prev, email: friendly }));
        if (/password|senha/i.test(error.message)) setErrors((prev) => ({ ...prev, password: friendly }));
        return;
      }

      if (data?.session) {
        registrarAceite({ data: { versao: TERMOS_VERSAO, marketingOptIn } }).catch((e) => {
          console.warn("[signup] falha ao registrar aceite dos termos", e);
        });
      }

      // Envia e-mail de boas-vindas (fire-and-forget). Não bloqueia o cadastro.
      try {
        supabase.functions
          .invoke("send-welcome-email", {
            body: { email: parsed.data.email, nome: parsed.data.nome },
          })
          .then(({ error: sendErr }) => {
            if (sendErr) console.warn("[signup] falha ao enviar boas-vindas", sendErr);
          });
      } catch (e) {
        console.warn("[signup] exceção ao chamar send-welcome-email", e);
      }

      toast.success("Conta criada com sucesso! Bem-vindo(a).");
      navigate({ to: "/onboarding" });
    } catch (err) {
      console.error("[signup] exceção inesperada", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  function FieldError({ name }: { name: string }) {
    if (!errors[name]) return null;
    return <p className="text-xs text-destructive mt-1">{errors[name]}</p>;
  }

  const tipo = form.tipo_pessoa;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-12">
      <Link to="/" className="flex justify-center mb-8">
        <AugustoLogo variant="stacked" theme="light" size={200} showTagline />
      </Link>
      <div className="w-full max-w-[440px] rounded-xl border border-border bg-card text-card-foreground p-10 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-center">Criar conta</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">3 dias de teste grátis. Sem cartão.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome" className="text-xs uppercase tracking-wide text-muted-foreground">Nome completo</Label>
            <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            <FieldError name="nome" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <FieldError name="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tel" className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</Label>
            <Input id="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required
              placeholder="(11) 99999-0000" />
            <FieldError name="telefone" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Você é</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["pf", "pj"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, tipo_pessoa: t })}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    tipo === t ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground/80 hover:border-primary/40 hover:bg-muted/40"}`}>
                  {t === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc" className="text-xs uppercase tracking-wide text-muted-foreground">
              {tipo === "pf" ? "CPF" : "CNPJ"}
            </Label>
            <Input id="doc" value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} required
              />
            <FieldError name="cpf_cnpj" />
          </div>
          {tipo === "pj" && (
            <div className="space-y-1.5">
              <Label htmlFor="rs" className="text-xs uppercase tracking-wide text-muted-foreground">Razão Social</Label>
              <Input id="rs" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} required
                />
              <FieldError name="razao_social" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="perfil" className="text-xs uppercase tracking-wide text-muted-foreground">
              Perfil de atuação
            </Label>
            <select
              id="perfil"
              value={form.perfil_atuacao}
              onChange={(e) =>
                setForm({ ...form, perfil_atuacao: e.target.value as typeof form.perfil_atuacao })
              }
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus:border-ring focus:ring-2 focus:ring-ring/40"
            >
              <option value="" disabled>Selecione…</option>
              <option value="sindico">Síndico</option>
              <option value="advogado">Advogado(a)</option>
              <option value="administradora">Administradora de condomínios</option>
              <option value="conselheiro">Conselheiro / membro do conselho</option>
              <option value="outro">Outro</option>
            </select>
            <FieldError name="perfil_atuacao" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <ul className="mt-1 space-y-0.5">
              <ReqItem ok={checks.len}>Pelo menos 8 caracteres</ReqItem>
              <ReqItem ok={checks.letter}>Contém uma letra</ReqItem>
              <ReqItem ok={checks.num}>Contém um número</ReqItem>
            </ul>
            <FieldError name="password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conf" className="text-xs uppercase tracking-wide text-muted-foreground">Confirmar senha</Label>
            <Input id="conf" type="password" autoComplete="new-password" value={form.confirmar}
              onChange={(e) => setForm({ ...form, confirmar: e.target.value })} required />
            {form.confirmar.length > 0 && (
              <ReqItem ok={checks.match}>Senhas coincidem</ReqItem>
            )}
            <FieldError name="confirmar" />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={lgpd} onCheckedChange={(c) => setLgpd(c === true)} className="mt-0.5" />
            <span className="text-muted-foreground">
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" rel="noopener" className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors duration-150">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" target="_blank" rel="noopener" className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors duration-150">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          <FieldError name="lgpd" />

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={marketingOptIn}
              onCheckedChange={(c) => setMarketingOptIn(c === true)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Aceito receber novidades e atualizações por e-mail.
            </span>
          </label>

          <Button type="submit" className="w-full font-semibold"
            disabled={loading || !lgpd} aria-busy={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-colors duration-150">Entrar</Link>
        </p>
      </div>
    </div>
  );
}