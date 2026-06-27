import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getProfile } from "@/lib/condominios.functions";
import { updateMyProfile } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", razao_social: "", cpf_cnpj: "" });
  const [saving, setSaving] = useState(false);
  const [plano, setPlano] = useState<{ nome: string; status: string; trial_end: string | null } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

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
          <div className="flex items-center justify-between">
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

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Plano atual</h2>
            {plano && (
              <Badge variant={plano.status === "trialing" ? "secondary" : "default"} className="uppercase">
                {plano.status === "trialing" ? "Trial" : plano.status}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Plano: <strong className="text-foreground">{plano?.nome ?? "—"}</strong>
            {plano?.trial_end && plano.status === "trialing" && (
              <> · expira em {new Date(plano.trial_end).toLocaleDateString("pt-BR")}</>
            )}
          </p>
          <div className="flex gap-2">
            <Button disabled>Gerenciar assinatura</Button>
            <Button variant="outline" disabled>Cancelar</Button>
          </div>
          <p className="text-xs text-muted-foreground">A integração de pagamento será habilitada em breve.</p>
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
      </div>
    </AppShell>
  );
}