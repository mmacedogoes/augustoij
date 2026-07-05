import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Download, PencilLine, MailX, Trash2, Shield, ExternalLink, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProfile } from "@/lib/condominios.functions";
import { updateMyProfile } from "@/lib/onboarding.functions";
import { getUsoAtual } from "@/lib/uso.functions";
import { UsageMeter } from "@/components/gates/UsageMeter";
import type { UsoAtual } from "@/lib/uso-limits";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarMarketingOptIn,
  getPreferenciaMarketing,
  solicitarExclusaoConta,
  solicitarExportacaoDados,
} from "@/lib/privacidade.functions";

export const Route = createFileRoute("/_authenticated/app/conta")({
  component: ContaPage,
});

type Profile = {
  nome: string | null;
  email: string | null;
  oab: string | null;
  telefone: string | null;
  tipo_pessoa: "pf" | "pj" | null;
  cpf_cnpj: string | null;
  razao_social: string | null;
  papel_sistema: string | null;
};

function ContaPage() {
  const router = useRouter();
  const fetchProfile = useServerFn(getProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const fetchUso = useServerFn(getUsoAtual);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", razao_social: "", cpf_cnpj: "" });
  const [saving, setSaving] = useState(false);
  const [plano, setPlano] = useState<{ nome: string; status: string; trial_end: string | null } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const { data: uso } = useQuery<UsoAtual>({
    queryKey: ["uso-atual"],
    queryFn: () => fetchUso() as unknown as Promise<UsoAtual>,
    staleTime: 30_000,
  });

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        const prof = p as Profile;
        setProfile(prof);
        setForm({
          nome: prof?.nome ?? "",
          telefone: prof?.telefone ?? "",
          razao_social: prof?.razao_social ?? "",
          cpf_cnpj: prof?.cpf_cnpj ?? "",
        });
      })
      .catch(() => {});
    supabase
      .from("subscriptions")
      .select("status, trial_end, planos(nome)")
      .maybeSingle()
      .then(({ data }: { data: { status: string; trial_end: string | null; planos: { nome: string } | { nome: string }[] | null } | null }) => {
        if (!data) return;
        const planoRel = Array.isArray(data.planos) ? data.planos[0] : data.planos;
        setPlano({
          nome: planoRel?.nome ?? "—",
          status: data.status,
          trial_end: data.trial_end,
        });
      });
  }, [fetchProfile]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveProfile({
        data: {
          nome: form.nome,
          telefone: form.telefone || null,
          razao_social: profile?.tipo_pessoa === "pj" ? form.razao_social || null : null,
          cpf_cnpj: form.cpf_cnpj || null,
        },
      });
      toast.success("Dados atualizados");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (novaSenha.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada");
    setNovaSenha("");
  }

  return (
    <AppShell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Conta e plano</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus dados, plano e segurança.</p>
        </div>

        <Card className="p-6 space-y-4">
          <div id="dados" className="flex items-center justify-between scroll-mt-24">
            <h2 className="font-semibold">Seus dados</h2>
            {profile?.tipo_pessoa && (
              <Badge variant="outline" className="uppercase text-[10px]">
                {profile.tipo_pessoa === "pj" ? "Pessoa jurídica" : "Pessoa física"}
              </Badge>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{profile?.tipo_pessoa === "pj" ? "CNPJ" : "CPF"}</Label>
              <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
            </div>
            {profile?.tipo_pessoa === "pj" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Razão social</Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Plano atual</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-xl font-semibold leading-tight text-foreground">
                  {uso?.planoNome ?? plano?.nome ?? "—"}
                </h2>
                {uso && (
                  <Badge
                    variant={uso.planoId === "gratuito" ? "secondary" : "default"}
                    className="uppercase tracking-wide"
                  >
                    {uso.planoId === "gratuito" ? "Trial" : "Ativo"}
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {uso?.planoId === "gratuito" && uso.trialFimIso ? (
                  uso.trialExpirado ? (
                    <span className="text-destructive">
                      Período gratuito expirado em{" "}
                      {new Date(uso.trialFimIso).toLocaleDateString("pt-BR")}
                    </span>
                  ) : (
                    <>
                      Expira em{" "}
                      <span className="font-medium text-foreground">
                        {new Date(uso.trialFimIso).toLocaleDateString("pt-BR")}
                      </span>
                      {uso.diasRestantesTrial !== null && (
                        <>
                          {" "}
                          · {uso.diasRestantesTrial}{" "}
                          {uso.diasRestantesTrial === 1 ? "dia restante" : "dias restantes"}
                        </>
                      )}
                    </>
                  )
                ) : uso ? (
                  <>
                    Renova em{" "}
                    <span className="font-medium text-foreground">
                      {new Date(uso.resetMesIso).toLocaleDateString("pt-BR")}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/" hash="pricing">
                <Sparkles className="h-3.5 w-3.5" /> Fazer upgrade
              </Link>
            </Button>
          </div>

          {uso && (uso.limiteMes !== null || uso.limiteDia !== null) && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              {uso.limiteMes !== null ? (
                <UsageMeter
                  used={uso.mensagensMes}
                  limit={uso.limiteMes}
                  label="Mensagens deste mês"
                  unit="mensagens"
                />
              ) : uso.limiteDia !== null ? (
                <UsageMeter
                  used={uso.mensagensDia}
                  limit={uso.limiteDia}
                  label="Mensagens de hoje"
                  unit="mensagens"
                />
              ) : null}
            </div>
          )}

          {uso && uso.limiteMes === null && uso.limiteDia === null && (
            <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Seu plano inclui mensagens ilimitadas.
            </p>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Segurança</h2>
          <div className="space-y-1.5 max-w-sm">
            <Label>Nova senha</Label>
            <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mín. 8 caracteres" />
          </div>
          <Button variant="outline" onClick={handlePasswordChange} disabled={!novaSenha}>
            Alterar senha
          </Button>
        </Card>

        <PrivacidadeSection />
      </div>
    </AppShell>
  );
}

function PrivacidadeSection() {
  const fetchPref = useServerFn(getPreferenciaMarketing);
  const salvarMarketing = useServerFn(atualizarMarketingOptIn);
  const solicitarExport = useServerFn(solicitarExportacaoDados);
  const solicitarExclusao = useServerFn(solicitarExclusaoConta);

  const [marketing, setMarketing] = useState<boolean | null>(null);
  const [salvandoMkt, setSalvandoMkt] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    fetchPref()
      .then((r) => setMarketing((r as { marketingOptIn: boolean }).marketingOptIn))
      .catch(() => setMarketing(false));
  }, [fetchPref]);

  async function toggleMarketing(next: boolean) {
    setMarketing(next);
    setSalvandoMkt(true);
    try {
      await salvarMarketing({ data: { optIn: next } });
      toast.success(next ? "Preferência atualizada." : "Você não receberá mais e-mails de marketing.");
    } catch (e) {
      setMarketing(!next);
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvandoMkt(false);
    }
  }

  async function handleExportar() {
    setExportando(true);
    try {
      await solicitarExport();
      toast.success("Seu arquivo será preparado e você receberá um link por e-mail em até 15 dias.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível solicitar a exportação.");
    } finally {
      setExportando(false);
    }
  }

  async function handleConfirmarExclusao() {
    setExcluindo(true);
    try {
      await solicitarExclusao();
      toast.success("Enviamos um link de confirmação para o seu e-mail.");
      setConfirmOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível solicitar a exclusão.");
    } finally {
      setExcluindo(false);
    }
  }

  function handleCorrigir() {
    const el = document.getElementById("dados");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const nomeInput = el?.parentElement?.querySelector("input");
    (nomeInput as HTMLInputElement | undefined)?.focus();
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Privacidade e dados</h2>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Exerça seus direitos previstos na LGPD (Lei 13.709/2018). Suas solicitações são
        registradas em nosso log de auditoria interno.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrivacyRow
          icon={<Download className="h-4 w-4" />}
          title="Baixar meus dados"
          description="Exportação completa de perfil, condomínios, conversas e uso."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportar}
              disabled={exportando}
              className="min-w-[112px] transition-transform duration-200 active:scale-[0.98]"
            >
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Solicitar"}
            </Button>
          }
        />
        <PrivacyRow
          icon={<PencilLine className="h-4 w-4" />}
          title="Corrigir meus dados"
          description="Edite nome, telefone e documento na seção acima."
          action={
            <Button size="sm" variant="outline" onClick={handleCorrigir}>
              Editar
            </Button>
          }
        />
        <PrivacyRow
          icon={<MailX className="h-4 w-4" />}
          title="E-mails de marketing"
          description="Não afeta e-mails de segurança ou confirmação."
          action={
            <div className="flex items-center gap-2">
              <Switch
                checked={marketing === true}
                disabled={marketing === null || salvandoMkt}
                onCheckedChange={toggleMarketing}
                aria-label="Receber e-mails de marketing"
              />
              <span className="text-xs text-muted-foreground">
                {marketing === true ? "Ativo" : "Revogado"}
              </span>
            </div>
          }
        />
        <PrivacyRow
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          title="Excluir minha conta"
          description="Ação irreversível após confirmação por e-mail."
          destructive
          action={
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              className="transition-transform duration-200 active:scale-[0.98]"
            >
              Excluir
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <Link
          to="/privacidade"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Política de Privacidade <ExternalLink className="h-3 w-3" />
        </Link>
        <Link
          to="/termos"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Termos de Uso <ExternalLink className="h-3 w-3" />
        </Link>
        <a
          href="mailto:privacidade@augusto.ij"
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          DPO: privacidade@augusto.ij
        </a>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              Esta ação é irreversível. Todos os seus dados, condomínios e histórico de
              conversas serão permanentemente excluídos em até 30 dias. Documentos enviados
              também serão removidos. Dados fiscais podem ser retidos pelo prazo legal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmarExclusao();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando…
                </>
              ) : (
                "Confirmar exclusão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function PrivacyRow({
  icon,
  title,
  description,
  action,
  destructive,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between ${
        destructive
          ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
          : "border-border/60 bg-muted/20 hover:border-border"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${
            destructive ? "bg-destructive/10 text-destructive" : "bg-background text-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="sm:flex-shrink-0">{action}</div>
    </div>
  );
}