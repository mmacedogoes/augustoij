import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getProprietario, upsertProprietario } from "@/lib/imoveis/proprietarios.functions";
import { proprietarioSchema, type ProprietarioInput } from "@/lib/imoveis/schemas";
import { maskCpf, maskTelefone } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/proprietarios/$id")({
  component: Page,
});

const empty: ProprietarioInput = {
  nome: "", cpf: null, estado_civil: null, profissao: null, rg: null, email: null, telefone: null,
  endereco: null, banco: null, agencia: null, conta: null, pix: null, observacoes: null,
};

function Page() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const getFn = useServerFn(getProprietario);
  const saveFn = useServerFn(upsertProprietario);
  const [form, setForm] = useState<ProprietarioInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    getFn({ data: { id } })
      .then((r) => setForm({ ...empty, ...(r as ProprietarioInput), id: r.id }))
      .catch((e) => toast.error(e.message));
  }, [id, isNew, getFn]);

  const set = <K extends keyof ProprietarioInput>(k: K, v: ProprietarioInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = proprietarioSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    try {
      await saveFn({ data: parsed.data });
      toast.success("Proprietário salvo");
      navigate({ to: "/app/admin/imoveis/proprietarios" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-primary">{isNew ? "Novo proprietário" : "Editar proprietário"}</h1>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <Card className="p-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required maxLength={200} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf ?? ""} onChange={(e) => set("cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>RG</Label>
              <Input value={form.rg ?? ""} onChange={(e) => set("rg", e.target.value)} />
            </div>
            <div>
              <Label>Estado civil</Label>
              <Input value={form.estado_civil ?? ""} onChange={(e) => set("estado_civil", e.target.value)} />
            </div>
            <div>
              <Label>Profissão</Label>
              <Input value={form.profissao ?? ""} onChange={(e) => set("profissao", e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", maskTelefone(e.target.value))} placeholder="(11) 90000-0000" />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={form.banco ?? ""} onChange={(e) => set("banco", e.target.value)} />
            </div>
            <div>
              <Label>Agência</Label>
              <Input value={form.agencia ?? ""} onChange={(e) => set("agencia", e.target.value)} />
            </div>
            <div>
              <Label>Conta</Label>
              <Input value={form.conta ?? ""} onChange={(e) => set("conta", e.target.value)} />
            </div>
            <div>
              <Label>PIX</Label>
              <Input value={form.pix ?? ""} onChange={(e) => set("pix", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/admin/imoveis/proprietarios" })}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}