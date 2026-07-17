import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { CheckCircle2 } from "lucide-react";
import { enviarContatoPersonalizado } from "@/lib/contato.functions";

export const Route = createFileRoute("/contato")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fale com a equipe — Plano Personalizado — Augusto.IJ" },
      { name: "description", content: "Montamos um plano sob medida para operações que precisam de mais. Deixe seus dados e nossa equipe entra em contato." },
      { property: "og:title", content: "Fale com a equipe — Augusto.IJ" },
      { property: "og:description", content: "Plano personalizado para operações que precisam de mais." },
      { property: "og:url", content: "https://augustoij.com.br/contato" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://augustoij.com.br/contato" }],
  }),
  component: ContatoPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Telefone inválido").max(40),
  mensagem: z.string().trim().min(10, "Descreva brevemente sua necessidade").max(2000),
});

function ContatoPage() {
  const enviar = useServerFn(enviarContatoPersonalizado);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", mensagem: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      toast.error(parsed.error.issues[0]?.message ?? "Revise os campos do formulário.");
      return;
    }
    setLoading(true);
    try {
      await enviar({ data: { ...parsed.data, website: form.website } });
      setSent(true);
      setForm({ nome: "", email: "", telefone: "", mensagem: "", website: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível enviar sua mensagem.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function FieldError({ name }: { name: string }) {
    if (!errors[name]) return null;
    return <p className="text-xs text-destructive mt-1">{errors[name]}</p>;
  }

  return (
    <div className="min-h-screen bg-augusto-cream text-augusto-slate-dark flex flex-col items-center px-4 py-12">
      <Link to="/" className="flex justify-center mb-8">
        <AugustoLogo variant="stacked" theme="light" size={180} showTagline />
      </Link>
      <div className="w-full max-w-[560px] rounded-xl border border-augusto-gold/20 bg-white p-8 md:p-10 shadow-sm">
        {sent ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-augusto-green-light/15 text-augusto-green">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="mt-4 font-serif text-augusto-green text-2xl">Mensagem recebida!</h1>
            <p className="mt-3 text-augusto-slate">
              Obrigado pelo interesse. Nossa equipe entrará em contato em breve pelo e-mail
              ou telefone informado.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-md border border-augusto-green/30 px-4 py-2 text-sm font-medium text-augusto-green hover:bg-augusto-green/5"
              >
                Voltar ao início
              </Link>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="inline-flex items-center justify-center rounded-md bg-augusto-green px-4 py-2 text-sm font-medium text-augusto-cream hover:bg-augusto-green-dark"
              >
                Enviar outra mensagem
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-augusto-green text-3xl leading-tight text-center">
              Plano Personalizado
            </h1>
            <p className="mt-3 text-center text-sm text-augusto-slate">
              Conte um pouco sobre sua operação e nossa equipe entrará em contato para montar
              um plano sob medida.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs uppercase tracking-wide text-augusto-slate">Nome</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required maxLength={120} />
                <FieldError name="nome" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs uppercase tracking-wide text-augusto-slate">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
                <FieldError name="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel" className="text-xs uppercase tracking-wide text-augusto-slate">Telefone</Label>
                <Input id="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required placeholder="(11) 99999-0000" maxLength={40} />
                <FieldError name="telefone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msg" className="text-xs uppercase tracking-wide text-augusto-slate">Mensagem</Label>
                <Textarea id="msg" rows={5} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} required maxLength={2000} placeholder="Quantos condomínios você administra, o que precisa, prazos…" />
                <FieldError name="mensagem" />
              </div>

              {/* honeypot */}
              <div aria-hidden="true" className="hidden">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full font-semibold bg-augusto-green text-augusto-cream hover:bg-augusto-green-dark" disabled={loading} aria-busy={loading}>
                {loading ? "Enviando…" : "Enviar mensagem"}
              </Button>
              <p className="text-center text-xs text-augusto-slate">
                Ao enviar, você concorda com nossa{" "}
                <Link to="/privacidade" className="underline hover:text-augusto-green">política de privacidade</Link>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
