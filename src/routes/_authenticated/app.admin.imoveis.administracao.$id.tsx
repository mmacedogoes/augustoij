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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getContratoAdministracao, upsertContratoAdministracao,
} from "@/lib/imoveis/contratos-administracao.functions";
import { listProprietarios } from "@/lib/imoveis/proprietarios.functions";
import { contratoAdministracaoSchema, type ContratoAdministracaoInput } from "@/lib/imoveis/schemas";
import { maskCpfCnpj } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/administracao/$id")({
  component: Page,
});

const empty: ContratoAdministracaoInput = {
  proprietario_id: "",
  administrador_nome: null, administrador_documento: null, administrador_oab: null,
  pix_recebimento: null, banco_recebimento: null, agencia_recebimento: null, conta_recebimento: null,
  percent_honorario_renovacao: 50, percent_honorario_mensal: 10,
  mora_multa_percent: 2, mora_juros_mensal_percent: 1, mora_indice: "IGP-M",
  data_inicio: null, prazo_meses: 24, status: "ativo", arquivo_contrato_url: null,
};

function Page() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const getFn = useServerFn(getContratoAdministracao);
  const saveFn = useServerFn(upsertContratoAdministracao);
  const listPropFn = useServerFn(listProprietarios);
  const [form, setForm] = useState<ContratoAdministracaoInput>(empty);
  const [proprietarios, setProprietarios] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPropFn().then((r) => setProprietarios(r.rows as { id: string; nome: string }[])).catch(() => {});
    if (!isNew) {
      getFn({ data: { id } })
        .then((r) => setForm({ ...empty, ...(r as ContratoAdministracaoInput), id: r.id }))
        .catch((e) => toast.error(e.message));
    }
  }, [id, isNew, getFn, listPropFn]);

  const set = <K extends keyof ContratoAdministracaoInput>(k: K, v: ContratoAdministracaoInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contratoAdministracaoSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    try {
      await saveFn({ data: parsed.data });
      toast.success("Contrato salvo");
      navigate({ to: "/app/admin/imoveis/administracao" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-primary">{isNew ? "Novo contrato de administração" : "Editar contrato de administração"}</h1>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <Card className="p-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Proprietário *</Label>
              <Select value={form.proprietario_id || undefined} onValueChange={(v) => set("proprietario_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {proprietarios.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Administrador (nome)</Label>
              <Input value={form.administrador_nome ?? ""} onChange={(e) => set("administrador_nome", e.target.value)} />
            </div>
            <div>
              <Label>Documento (CPF/CNPJ)</Label>
              <Input value={form.administrador_documento ?? ""} onChange={(e) => set("administrador_documento", maskCpfCnpj(e.target.value))} />
            </div>
            <div>
              <Label>OAB</Label>
              <Input value={form.administrador_oab ?? ""} onChange={(e) => set("administrador_oab", e.target.value)} />
            </div>
            <div>
              <Label>PIX de recebimento</Label>
              <Input value={form.pix_recebimento ?? ""} onChange={(e) => set("pix_recebimento", e.target.value)} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={form.banco_recebimento ?? ""} onChange={(e) => set("banco_recebimento", e.target.value)} />
            </div>
            <div>
              <Label>Agência</Label>
              <Input value={form.agencia_recebimento ?? ""} onChange={(e) => set("agencia_recebimento", e.target.value)} />
            </div>
            <div>
              <Label>Conta</Label>
              <Input value={form.conta_recebimento ?? ""} onChange={(e) => set("conta_recebimento", e.target.value)} />
            </div>
            <div>
              <Label>Honorário mensal (%)</Label>
              <Input type="number" step="0.01" value={form.percent_honorario_mensal}
                onChange={(e) => set("percent_honorario_mensal", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Honorário de renovação (%)</Label>
              <Input type="number" step="0.01" value={form.percent_honorario_renovacao}
                onChange={(e) => set("percent_honorario_renovacao", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Multa de mora (%)</Label>
              <Input type="number" step="0.01" value={form.mora_multa_percent}
                onChange={(e) => set("mora_multa_percent", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Juros de mora mensais (%)</Label>
              <Input type="number" step="0.01" value={form.mora_juros_mensal_percent}
                onChange={(e) => set("mora_juros_mensal_percent", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Índice de mora</Label>
              <Input value={form.mora_indice} onChange={(e) => set("mora_indice", e.target.value)} />
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value || null)} />
            </div>
            <div>
              <Label>Prazo (meses)</Label>
              <Input type="number" min={1} value={form.prazo_meses}
                onChange={(e) => set("prazo_meses", e.target.value === "" ? 24 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Status</Label>
              <Input value={form.status} onChange={(e) => set("status", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>URL do PDF do contrato (opcional)</Label>
              <Input value={form.arquivo_contrato_url ?? ""} onChange={(e) => set("arquivo_contrato_url", e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/admin/imoveis/administracao" })}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}