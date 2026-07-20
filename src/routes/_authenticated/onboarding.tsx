import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Check, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";
import { getProfile, createCondominio } from "@/lib/condominios.functions";
import {
  listPlanosByTipo,
  updateMyProfile,
  assinarPlano,
  completarOnboarding,
  solicitarContatoIlimitado,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

type Profile = {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  tipo_pessoa: "pf" | "pj" | null;
  cpf_cnpj: string | null;
  razao_social: string | null;
};

type Plano = {
  id: string;
  nome: string;
  preco_mensal: number | null;
  limite_condominios: number | null;
  limite_usuarios: number | null;
  limite_mensagens_mes: number | null;
  limite_storage_mb: number | null;
  descricao: string | null;
  features: string[];
};

const condoSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().max(20).optional(),
  endereco: z.string().trim().max(255).optional(),
  uf: z.string().trim().length(2).optional(),
  qtd_unidades: z.coerce.number().int().min(0).max(100000).optional(),
});

function Step({ n, label, current }: { n: number; label: string; current: number }) {
  const done = current > n;
  const active = current === n;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border ${
        done ? "bg-augusto-gold text-augusto-green border-augusto-gold"
          : active ? "bg-augusto-cream text-augusto-green border-augusto-cream"
          : "bg-transparent text-augusto-cream/60 border-augusto-cream/25"
      }`}>{done ? <Check className="h-4 w-4" /> : n}</div>
      <span className={active || done ? "text-augusto-cream" : "text-augusto-cream/60"}>{label}</span>
    </div>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const fetchPlanos = useServerFn(listPlanosByTipo);
  const assinar = useServerFn(assinarPlano);
  const concluir = useServerFn(completarOnboarding);
  const criarCondo = useServerFn(createCondominio);
  const enviarContato = useServerFn(solicitarContatoIlimitado);

  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [chosenPlano, setChosenPlano] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [contatoOpen, setContatoOpen] = useState(false);
  const [contato, setContato] = useState({ nome: "", telefone: "", email: "", mensagem: "" });

  const [form, setForm] = useState({ nome: "", telefone: "", tipo_pessoa: "pf" as "pf" | "pj", cpf_cnpj: "", razao_social: "" });
  const [condo, setCondo] = useState({ nome: "", cnpj: "", endereco: "", uf: "", qtd_unidades: "" });

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        const pr = (p ?? {
          nome: null,
          email: null,
          telefone: null,
          tipo_pessoa: "pf",
          cpf_cnpj: null,
          razao_social: null,
        }) as Profile;
        setProfile(pr);
        setForm({
          nome: pr.nome ?? "",
          telefone: pr.telefone ?? "",
          tipo_pessoa: (pr.tipo_pessoa ?? "pf") as "pf" | "pj",
          cpf_cnpj: pr.cpf_cnpj ?? "",
          razao_social: pr.razao_social ?? "",
        });
        setContato((c) => ({
          ...c,
          nome: pr.nome ?? "",
          email: pr.email ?? "",
          telefone: pr.telefone ?? "",
        }));
      })
      .catch((e) => {
        console.error("[onboarding] falha ao carregar perfil", e);
        toast.error("Não conseguimos carregar seu perfil. Recarregue a página.");
        setProfile({
          nome: null,
          email: null,
          telefone: null,
          tipo_pessoa: "pf",
          cpf_cnpj: null,
          razao_social: null,
        });
      });
  }, [fetchProfile]);

  useEffect(() => {
    if (step !== 2) return;
    fetchPlanos({ data: { tipo_pessoa: form.tipo_pessoa } }).then((rows) => setPlanos(rows as Plano[]));
  }, [step, form.tipo_pessoa, fetchPlanos]);

  async function nextFromStep1() {
    if (form.nome.trim().length < 2) return toast.error("Informe seu nome");
    setBusy(true);
    try {
      await updateProfile({ data: {
        nome: form.nome.trim(),
        telefone: form.telefone || null,
        tipo_pessoa: form.tipo_pessoa,
        cpf_cnpj: form.cpf_cnpj || null,
        razao_social: form.tipo_pessoa === "pj" ? (form.razao_social || null) : null,
      } });
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function escolherPlano(p: Plano) {
    if (p.preco_mensal === null) {
      setContatoOpen(true);
      return;
    }
    setBusy(true);
    try {
      await assinar({ data: { plano_id: p.id } });
      setChosenPlano(p.id);
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function enviarContatoForm() {
    setBusy(true);
    try {
      await enviarContato({ data: contato });
      toast.success("Mensagem enviada! Vamos entrar em contato em breve.");
      setContatoOpen(false);
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function finalizar(comCondo: boolean) {
    setBusy(true);
    try {
      if (comCondo) {
        const parsed = condoSchema.safeParse(condo);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setBusy(false);
          return;
        }
        await criarCondo({ data: {
          nome: parsed.data.nome,
          cnpj: parsed.data.cnpj || null,
          endereco: parsed.data.endereco || null,
          uf: parsed.data.uf || null,
          qtd_unidades: parsed.data.qtd_unidades ?? null,
        } });
      }
      await concluir({});
      toast.success("Tudo pronto! Bem-vindo ao Augusto.IJ.");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  const tipoLabel = form.tipo_pessoa === "pj" ? "PJ" : "PF";

  return (
    <div className="min-h-screen bg-augusto-green text-augusto-cream px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-center mb-8"><Logo variant="inverted" size="md" /></div>

        <div className="flex items-center justify-between mb-10 border-b border-augusto-cream/15 pb-6">
          <Step n={1} label="Dados pessoais" current={step} />
          <div className="h-px w-10 bg-augusto-cream/20" />
          <Step n={2} label="Escolher plano" current={step} />
          <div className="h-px w-10 bg-augusto-cream/20" />
          <Step n={3} label="Primeiro condomínio" current={step} />
        </div>

        {step === 1 && (
          <div className="rounded-xl border border-augusto-cream/15 bg-augusto-green-dark p-8">
            <h1 className="text-2xl font-bold">Confirme seus dados</h1>
            <p className="text-augusto-cream/70 mt-1 text-sm">Você pode alterar esses dados depois em seu perfil.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase text-augusto-cream/70">Nome completo</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">E-mail</Label>
                <Input value={profile?.email ?? ""} disabled className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">Tipo de pessoa</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["pf","pj"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, tipo_pessoa: t })}
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${
                        form.tipo_pessoa === t ? "border-augusto-gold bg-augusto-gold/15 text-augusto-gold-light"
                          : "border-augusto-cream/15 text-augusto-cream/85"}`}>
                      {t === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">{form.tipo_pessoa === "pf" ? "CPF" : "CNPJ"}</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              {form.tipo_pessoa === "pj" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs uppercase text-augusto-cream/70">Razão Social</Label>
                  <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                    className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
                </div>
              )}
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={nextFromStep1} disabled={busy}
                className="bg-augusto-gold hover:bg-augusto-gold-light text-augusto-green font-semibold">Continuar</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-6 rounded-md border border-emerald-700/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <Sparkles className="inline h-4 w-4 mr-1.5 mb-0.5" />
              Você tem 7 dias de teste grátis. Não cobramos nada agora — você só será cobrado quando a integração de pagamento for ativada.
            </div>
            <h2 className="text-2xl font-bold">Escolha seu plano {tipoLabel}</h2>
            <p className="text-augusto-cream/70 text-sm mt-1">Você pode trocar de plano a qualquer momento em sua conta.</p>

            <div className={`mt-6 grid gap-4 ${planos.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {planos.map((p) => {
                const isIlimitado = p.preco_mensal === null;
                const destaque = p.id === "pj_starter";
                return (
                  <div key={p.id}
                    className={`relative rounded-xl border p-6 flex flex-col ${
                      destaque ? "border-augusto-gold bg-augusto-green-dark" : "border-augusto-cream/15 bg-augusto-green-dark"
                    }`}>
                    {destaque && (
                      <span className="absolute -top-2.5 left-6 rounded-full bg-augusto-gold text-augusto-green text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                        Mais popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{p.nome}</h3>
                    <div className="mt-2">
                      {isIlimitado ? (
                        <p className="text-2xl font-bold">Sob consulta</p>
                      ) : (
                        <p className="text-2xl font-bold">
                          R$ {Number(p.preco_mensal).toFixed(0)}
                          <span className="text-sm font-normal text-augusto-cream/70">/mês</span>
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-augusto-cream/70">{p.descricao}</p>
                    <ul className="mt-4 space-y-1.5 text-sm flex-1">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-augusto-cream/85">
                          <Check className="h-4 w-4 text-augusto-gold-light shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => escolherPlano(p)} disabled={busy}
                      className={`mt-5 w-full ${destaque ? "bg-augusto-gold hover:bg-augusto-gold-light text-augusto-green" : "bg-augusto-cream text-augusto-green hover:bg-augusto-cream-dark"}`}>
                      {isIlimitado ? "Falar com consultor" : "Escolher plano"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl border border-augusto-cream/15 bg-augusto-green-dark p-8">
            <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-augusto-gold-light" />
              <h2 className="text-2xl font-bold">Cadastre seu primeiro condomínio</h2>
            </div>
            <p className="text-augusto-cream/70 text-sm mt-1">
              Você pode cadastrar seus condomínios a qualquer momento dentro do sistema.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase text-augusto-cream/70">Nome do condomínio</Label>
                <Input value={condo.nome} onChange={(e) => setCondo({ ...condo, nome: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">CNPJ (opcional)</Label>
                <Input value={condo.cnpj} onChange={(e) => setCondo({ ...condo, cnpj: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">UF</Label>
                <Input maxLength={2} value={condo.uf} onChange={(e) => setCondo({ ...condo, uf: e.target.value.toUpperCase() })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs uppercase text-augusto-cream/70">Endereço</Label>
                <Input value={condo.endereco} onChange={(e) => setCondo({ ...condo, endereco: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase text-augusto-cream/70">Número de unidades</Label>
                <Input type="number" value={condo.qtd_unidades}
                  onChange={(e) => setCondo({ ...condo, qtd_unidades: e.target.value })}
                  className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-2 items-center">
              <Button onClick={() => finalizar(true)} disabled={busy}
                className="w-full sm:w-auto bg-augusto-gold hover:bg-augusto-gold-light text-augusto-green font-semibold">
                Cadastrar condomínio
              </Button>
              <button onClick={() => finalizar(false)} disabled={busy}
                className="text-sm text-augusto-cream/70 hover:text-augusto-cream underline underline-offset-4">
                Pular esta etapa
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={contatoOpen} onOpenChange={setContatoOpen}>
        <DialogContent className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream">
          <DialogHeader>
            <DialogTitle className="text-augusto-cream flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-augusto-gold-light" /> Falar com consultor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-augusto-cream/70">Nome</Label>
              <Input value={contato.nome} onChange={(e) => setContato({ ...contato, nome: e.target.value })}
                className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-augusto-cream/70">Telefone</Label>
              <Input value={contato.telefone} onChange={(e) => setContato({ ...contato, telefone: e.target.value })}
                className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-augusto-cream/70">E-mail</Label>
              <Input value={contato.email} onChange={(e) => setContato({ ...contato, email: e.target.value })}
                className="bg-augusto-green-dark border-augusto-cream/15 text-augusto-cream" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-augusto-cream/70">Mensagem</Label>
              <textarea value={contato.mensagem} onChange={(e) => setContato({ ...contato, mensagem: e.target.value })}
                rows={4} className="w-full rounded-md bg-augusto-green-dark border border-augusto-cream/15 text-augusto-cream p-2 text-sm" />
            </div>
            <Button onClick={enviarContatoForm} disabled={busy}
              className="w-full bg-augusto-gold hover:bg-augusto-gold-light text-augusto-green">Enviar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}