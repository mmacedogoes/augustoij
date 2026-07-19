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
import { getContratoLocacao, upsertContratoLocacao } from "@/lib/imoveis/contratos-locacao.functions";
import { listImoveis } from "@/lib/imoveis/imoveis.functions";
import { contratoLocacaoSchema, type ContratoLocacaoInput } from "@/lib/imoveis/schemas";
import { maskCpf, maskTelefone, parseBRL, formatBRL } from "@/lib/imoveis/masks";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/locacao/$id")({
  component: Page,
});

const emptyCaucao: ContratoLocacaoInput["caucao"] = {
  possui: false, valor_depositado: null, tipo: null, corrige_com_rendimento: true,
  data_deposito: null, valor_atual_override: null, observacoes: null,
};

const empty: ContratoLocacaoInput = {
  imovel_id: "",
  inquilino_nome: null, inquilino_cpf: null, inquilino_estado_civil: null, inquilino_profissao: null,
  inquilino_rg: null, inquilino_email: null, inquilino_telefone: null, inquilino_endereco: null,
  valor_aluguel: null, dia_vencimento: null,
  valor_aluguel_inicial: null,
  data_contrato_original: null, data_inicio_vigencia: null, prazo_meses: null,
  indice_reajuste: "IGP-M", periodicidade_reajuste_meses: 12, mes_base_reajuste: null,
  encargos_inquilino: { condominio: true, agua: true, luz: true, iptu: true, tcr: true },
  multa_mora_percent: 2, juros_mora_mensal_percent: 1,
  multa_rescisoria_multiplicador: 3, multa_rescisoria_proporcional: true,
  aviso_previo_dias: 30, foro: null, status: "ativo", arquivo_contrato_url: null,
  caucao: emptyCaucao,
};

type ImovelOption = {
  id: string; descricao: string | null; edificio: string | null; endereco: string | null;
  numero_unidade: string | null; proprietarios: { nome: string } | null;
};

function Page() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const getFn = useServerFn(getContratoLocacao);
  const saveFn = useServerFn(upsertContratoLocacao);
  const listImoveisFn = useServerFn(listImoveis);
  const [form, setForm] = useState<ContratoLocacaoInput>(empty);
  const [imoveis, setImoveis] = useState<ImovelOption[]>([]);
  const [valorAluguelStr, setValorAluguelStr] = useState<string>("");
  const [valorCaucaoStr, setValorCaucaoStr] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listImoveisFn().then((r) => setImoveis(r.rows as unknown as ImovelOption[])).catch(() => {});
    if (!isNew) {
      getFn({ data: { id } })
        .then((r) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row: any = r;
          const caucaoRow = Array.isArray(row.caucoes) ? row.caucoes[0] : row.caucoes;
          setForm({
            ...empty,
            ...row,
            id: row.id,
            encargos_inquilino: row.encargos_inquilino ?? empty.encargos_inquilino,
            caucao: caucaoRow
              ? {
                  possui: !!caucaoRow.possui,
                  valor_depositado: caucaoRow.valor_depositado,
                  tipo: caucaoRow.tipo,
                  corrige_com_rendimento: !!caucaoRow.corrige_com_rendimento,
                  data_deposito: caucaoRow.data_deposito,
                  valor_atual_override: caucaoRow.valor_atual_override,
                  observacoes: caucaoRow.observacoes,
                }
              : emptyCaucao,
          });
          setValorAluguelStr(row.valor_aluguel != null ? formatBRL(Number(row.valor_aluguel)) : "");
          setValorCaucaoStr(caucaoRow?.valor_depositado != null ? formatBRL(Number(caucaoRow.valor_depositado)) : "");
        })
        .catch((e) => toast.error(e.message));
    }
  }, [id, isNew, getFn, listImoveisFn]);

  const set = <K extends keyof ContratoLocacaoInput>(k: K, v: ContratoLocacaoInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setCaucao = <K extends keyof ContratoLocacaoInput["caucao"]>(k: K, v: ContratoLocacaoInput["caucao"][K]) =>
    setForm((f) => ({ ...f, caucao: { ...f.caucao, [k]: v } }));
  const setEncargo = (k: keyof ContratoLocacaoInput["encargos_inquilino"], v: boolean) =>
    setForm((f) => ({ ...f, encargos_inquilino: { ...f.encargos_inquilino, [k]: v } }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contratoLocacaoSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    try {
      await saveFn({ data: parsed.data });
      toast.success("Contrato salvo");
      navigate({ to: "/app/admin/imoveis/locacao" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const encargos = form.encargos_inquilino;

  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold text-primary">{isNew ? "Novo contrato de locação" : "Editar contrato de locação"}</h1>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />
        <form onSubmit={onSubmit} className="space-y-4">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-primary">Imóvel</h2>
            <div>
              <Label>Imóvel *</Label>
              <Select value={form.imovel_id || undefined} onValueChange={(v) => set("imovel_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
                <SelectContent>
                  {imoveis.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {(i.descricao || i.edificio || i.endereco || "Imóvel")}
                      {i.numero_unidade ? ` — un. ${i.numero_unidade}` : ""}
                      {i.proprietarios?.nome ? ` · ${i.proprietarios.nome}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-6 grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-primary sm:col-span-2">Inquilino</h2>
            <div className="sm:col-span-2">
              <Label>Nome</Label>
              <Input value={form.inquilino_nome ?? ""} onChange={(e) => set("inquilino_nome", e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.inquilino_cpf ?? ""} onChange={(e) => set("inquilino_cpf", maskCpf(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>RG</Label>
              <Input value={form.inquilino_rg ?? ""} onChange={(e) => set("inquilino_rg", e.target.value)} />
            </div>
            <div>
              <Label>Estado civil</Label>
              <Input value={form.inquilino_estado_civil ?? ""} onChange={(e) => set("inquilino_estado_civil", e.target.value)} />
            </div>
            <div>
              <Label>Profissão</Label>
              <Input value={form.inquilino_profissao ?? ""} onChange={(e) => set("inquilino_profissao", e.target.value)} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.inquilino_email ?? ""} onChange={(e) => set("inquilino_email", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.inquilino_telefone ?? ""} onChange={(e) => set("inquilino_telefone", maskTelefone(e.target.value))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.inquilino_endereco ?? ""} onChange={(e) => set("inquilino_endereco", e.target.value)} />
            </div>
          </Card>

          <Card className="p-6 grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-primary sm:col-span-2">Valores e prazo</h2>
            <div>
              <Label>Valor do aluguel</Label>
              <Input
                value={valorAluguelStr}
                onChange={(e) => { setValorAluguelStr(e.target.value); set("valor_aluguel", parseBRL(e.target.value)); }}
                onBlur={() => setValorAluguelStr(form.valor_aluguel != null ? formatBRL(form.valor_aluguel) : "")}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label>Dia de vencimento (1-31)</Label>
              <Input type="number" min={1} max={31}
                value={form.dia_vencimento ?? ""}
                onChange={(e) => set("dia_vencimento", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div>
              <Label>Data do contrato original</Label>
              <Input type="date" value={form.data_contrato_original ?? ""} onChange={(e) => set("data_contrato_original", e.target.value || null)} />
            </div>
            <div>
              <Label>Início da vigência</Label>
              <Input type="date" value={form.data_inicio_vigencia ?? ""} onChange={(e) => set("data_inicio_vigencia", e.target.value || null)} />
            </div>
            <div>
              <Label>Prazo (meses)</Label>
              <Input type="number" min={1}
                value={form.prazo_meses ?? ""}
                onChange={(e) => set("prazo_meses", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as ContratoLocacaoInput["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="renovado">Renovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-6 grid gap-4 sm:grid-cols-3">
            <h2 className="text-lg font-semibold text-primary sm:col-span-3">Reajuste</h2>
            <div>
              <Label>Índice</Label>
              <Input value={form.indice_reajuste} onChange={(e) => set("indice_reajuste", e.target.value)} />
            </div>
            <div>
              <Label>Periodicidade (meses)</Label>
              <Input type="number" min={1}
                value={form.periodicidade_reajuste_meses}
                onChange={(e) => set("periodicidade_reajuste_meses", e.target.value === "" ? 12 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Mês-base (1-12)</Label>
              <Input type="number" min={1} max={12}
                value={form.mes_base_reajuste ?? ""}
                onChange={(e) => set("mes_base_reajuste", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-primary mb-3">Encargos por conta do inquilino</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              {(["condominio","agua","luz","iptu","tcr"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={encargos[k]} onCheckedChange={(v) => setEncargo(k, Boolean(v))} />
                  <span className="capitalize">{k === "tcr" ? "TCR" : k}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="p-6 grid gap-4 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-primary sm:col-span-2">Mora, multa e aviso prévio</h2>
            <div>
              <Label>Multa de mora (%)</Label>
              <Input type="number" step="0.01" value={form.multa_mora_percent}
                onChange={(e) => set("multa_mora_percent", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Juros de mora mensais (%)</Label>
              <Input type="number" step="0.01" value={form.juros_mora_mensal_percent}
                onChange={(e) => set("juros_mora_mensal_percent", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Multa rescisória (× aluguel)</Label>
              <Input type="number" step="0.01" value={form.multa_rescisoria_multiplicador}
                onChange={(e) => set("multa_rescisoria_multiplicador", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="prop" checked={form.multa_rescisoria_proporcional} onCheckedChange={(v) => set("multa_rescisoria_proporcional", Boolean(v))} />
              <Label htmlFor="prop">Multa rescisória proporcional ao tempo restante</Label>
            </div>
            <div>
              <Label>Aviso prévio (dias)</Label>
              <Input type="number" min={0} value={form.aviso_previo_dias}
                onChange={(e) => set("aviso_previo_dias", e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div>
              <Label>Foro</Label>
              <Input value={form.foro ?? ""} onChange={(e) => set("foro", e.target.value)} />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="possui-caucao" checked={form.caucao.possui} onCheckedChange={(v) => setCaucao("possui", Boolean(v))} />
              <h2 className="text-lg font-semibold text-primary">Possui caução</h2>
            </div>
            {form.caucao.possui && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Valor depositado</Label>
                  <Input
                    value={valorCaucaoStr}
                    onChange={(e) => { setValorCaucaoStr(e.target.value); setCaucao("valor_depositado", parseBRL(e.target.value)); }}
                    onBlur={() => setValorCaucaoStr(form.caucao.valor_depositado != null ? formatBRL(form.caucao.valor_depositado) : "")}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.caucao.tipo ?? undefined} onValueChange={(v) => setCaucao("tipo", v as "poupanca" | "dinheiro" | "seguro" | "outro")}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="seguro">Seguro-fiança</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data do depósito</Label>
                  <Input type="date" value={form.caucao.data_deposito ?? ""} onChange={(e) => setCaucao("data_deposito", e.target.value || null)} />
                </div>
                <div>
                  <Label>Valor atual (override manual)</Label>
                  <Input type="number" step="0.01" value={form.caucao.valor_atual_override ?? ""}
                    onChange={(e) => setCaucao("valor_atual_override", e.target.value === "" ? null : Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="corrige" checked={form.caucao.corrige_com_rendimento} onCheckedChange={(v) => setCaucao("corrige_com_rendimento", Boolean(v))} />
                  <Label htmlFor="corrige">Corrigir com rendimento</Label>
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={form.caucao.observacoes ?? ""} onChange={(e) => setCaucao("observacoes", e.target.value)} />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <Label>URL do PDF do contrato (opcional)</Label>
            <Input value={form.arquivo_contrato_url ?? ""} onChange={(e) => set("arquivo_contrato_url", e.target.value)} placeholder="https://..." />
          </Card>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/admin/imoveis/locacao" })}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar contrato"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}