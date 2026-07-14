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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getImovel, upsertImovel } from "@/lib/imoveis/imoveis.functions";
import { listProprietarios } from "@/lib/imoveis/proprietarios.functions";
import { imovelSchema, type ImovelInput } from "@/lib/imoveis/schemas";
import { maskCep } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/unidades/$id")({
  component: Page,
});

const empty: ImovelInput = {
  proprietario_id: "", descricao: null, endereco: null, edificio: null, numero_unidade: null,
  cep: null, cidade: null, uf: null, matricula: null, quartos: null, vaga_garagem: false,
  area: null, observacoes: null,
};

function Page() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const getFn = useServerFn(getImovel);
  const saveFn = useServerFn(upsertImovel);
  const listPropFn = useServerFn(listProprietarios);
  const [form, setForm] = useState<ImovelInput>(empty);
  const [proprietarios, setProprietarios] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPropFn().then((r) => setProprietarios(r.rows as { id: string; nome: string }[])).catch(() => {});
    if (!isNew) {
      getFn({ data: { id } })
        .then((r) => setForm({ ...empty, ...(r as ImovelInput), id: r.id }))
        .catch((e) => toast.error(e.message));
    }
  }, [id, isNew, getFn, listPropFn]);

  const set = <K extends keyof ImovelInput>(k: K, v: ImovelInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = imovelSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    try {
      await saveFn({ data: parsed.data });
      toast.success("Imóvel salvo");
      navigate({ to: "/app/admin/imoveis/unidades" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-primary">{isNew ? "Novo imóvel" : "Editar imóvel"}</h1>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <Card className="p-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Proprietário *</Label>
              <Select value={form.proprietario_id || undefined} onValueChange={(v) => set("proprietario_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o proprietário" /></SelectTrigger>
                <SelectContent>
                  {proprietarios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)}
                placeholder="Ex.: Apto 802 — Ed. Alfa" />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <Label>Edifício</Label>
              <Input value={form.edificio ?? ""} onChange={(e) => set("edificio", e.target.value)} />
            </div>
            <div>
              <Label>Nº da unidade</Label>
              <Input value={form.numero_unidade ?? ""} onChange={(e) => set("numero_unidade", e.target.value)} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.cep ?? ""} onChange={(e) => set("cep", maskCep(e.target.value))} placeholder="00000-000" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input value={form.matricula ?? ""} onChange={(e) => set("matricula", e.target.value)} />
            </div>
            <div>
              <Label>Quartos</Label>
              <Input type="number" min={0} value={form.quartos ?? ""} onChange={(e) => set("quartos", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div>
              <Label>Área (m²)</Label>
              <Input type="number" step="0.01" min={0} value={form.area ?? ""} onChange={(e) => set("area", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="vaga" checked={form.vaga_garagem} onCheckedChange={(v) => set("vaga_garagem", Boolean(v))} />
              <Label htmlFor="vaga">Possui vaga de garagem</Label>
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/admin/imoveis/unidades" })}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}