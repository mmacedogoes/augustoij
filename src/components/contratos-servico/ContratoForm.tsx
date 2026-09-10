import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Briefcase, Calendar, DollarSign, Scale, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper, Step } from "@/components/ui/stepper";
import { Card } from "@/components/ui/card";
import {
  listCondominiosParaContratos,
  listTiposServicoContrato,
  upsertContratoServico,
} from "@/lib/contratos-servico/contratos.functions";
import type { ContratoServicoInput } from "@/lib/contratos-servico/schemas";

type Condo = { id: string; nome: string; cidade: string | null; uf: string | null };
type Tipo = { id: string; slug: string; nome: string; terceirizacao_padrao: boolean };

export type ContratoFormValues = Partial<ContratoServicoInput> & { id?: string };

export function ContratoForm({
  initial,
  onSaved,
  submitLabel = "Salvar contrato",
  onOverrideSubmit,
}: {
  initial?: ContratoFormValues;
  onSaved: (id: string) => void;
  submitLabel?: string;
  /**
   * Se informado, é chamado em vez de `upsertContratoServico` no submit.
   * Usado pelo wizard de importação para persistir contrato + obrigações
   * em uma única server function.
   */
  onOverrideSubmit?: (values: ContratoServicoInput) => Promise<{ id: string }>;
}) {
  const condosFn = useServerFn(listCondominiosParaContratos);
  const tiposFn = useServerFn(listTiposServicoContrato);
  const salvarFn = useServerFn(upsertContratoServico);

  const [condos, setCondos] = useState<Condo[] | null>(null);
  const [tipos, setTipos] = useState<Tipo[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState(1);

  const [form, setForm] = useState<ContratoFormValues>(() => ({
    situacao: "ativo",
    tipo_valor: "mensal",
    indice_reajuste: "igpm",
    terceirizacao_mao_de_obra: false,
    prazo_indeterminado: false,
    renovacao_automatica: false,
    exige_seguro_rc: false,
    ...initial,
  }));

  useEffect(() => {
    let alivo = true;
    Promise.all([condosFn(), tiposFn()])
      .then(([c, t]) => {
        if (!alivo) return;
        setCondos(c.rows as Condo[]);
        setTipos(t.rows as Tipo[]);
      })
      .catch((e: Error) => alivo && setLoadErr(e.message));
    return () => {
      alivo = false;
    };
  }, [condosFn, tiposFn]);

  const tipoSelecionado = useMemo(
    () => tipos?.find((t) => t.id === form.tipo_servico_id) ?? null,
    [tipos, form.tipo_servico_id],
  );

  const condominioSelecionado = useMemo(
    () => condos?.find((c) => c.id === form.condominio_id) ?? null,
    [condos, form.condominio_id]
  );

  function set<K extends keyof ContratoFormValues>(k: K, v: ContratoFormValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (erros[k as string]) setErros((e) => ({ ...e, [k as string]: "" }));
  }

  function handleTipoChange(id: string) {
    const t = tipos?.find((x) => x.id === id) ?? null;
    setForm((f) => ({
      ...f,
      tipo_servico_id: id,
      terceirizacao_mao_de_obra: t?.terceirizacao_padrao ?? f.terceirizacao_mao_de_obra ?? false,
    }));
  }

  function validarPasso(passo: number): boolean {
    const novos: Record<string, string> = {};

    if (passo === 1) {
      if (!form.condominio_id) novos.condominio_id = "Selecione um condomínio";
      if (!form.prestador_nome || form.prestador_nome.trim() === "")
        novos.prestador_nome = "Nome do prestador é obrigatório";
    } else if (passo === 2) {
      if (!form.prazo_indeterminado && !form.data_fim)
        novos.data_fim = "Informe a data de fim ou marque prazo indeterminado";
      if (
        !form.prazo_indeterminado &&
        form.data_inicio &&
        form.data_fim &&
        form.data_fim <= form.data_inicio
      )
        novos.data_fim = "A data de fim deve ser posterior à data de início";
    } else if (passo === 3) {
      if (
        form.dia_vencimento !== null &&
        form.dia_vencimento !== undefined &&
        (form.dia_vencimento < 1 || form.dia_vencimento > 31)
      )
        novos.dia_vencimento = "Dia entre 1 e 31";
    }

    if (Object.keys(novos).length > 0) {
      setErros((prev) => ({ ...prev, ...novos }));
      toast.error("Preencha os campos obrigatórios deste passo.");
      return false;
    }
    return true;
  }

  function handleAvancar() {
    if (validarPasso(activeStep)) {
      setActiveStep((prev) => Math.min(prev + 1, 4));
    }
  }

  function handleVoltar() {
    setActiveStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    
    // Validação global
    if (!validarPasso(1) || !validarPasso(2) || !validarPasso(3)) {
      return;
    }

    setSalvando(true);
    try {
      const values = form as ContratoServicoInput;
      const r = onOverrideSubmit
        ? await onOverrideSubmit(values)
        : await salvarFn({ data: values });
      toast.success(form.id ? "Contrato atualizado" : "Contrato criado");
      onSaved(r.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  if (loadErr) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Não foi possível carregar os dados: {loadErr}
      </div>
    );
  }
  if (!condos || !tipos) {
    return <div className="text-sm text-muted-foreground">Carregando formulário…</div>;
  }
  if (condos.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Cadastre um condomínio antes de criar contratos de serviço.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ReUI Stepper Navigation */}
      <Card className="p-4 border-augusto-gold/20 bg-card/60 backdrop-blur">
        <Stepper
          activeStep={activeStep}
          onStepClick={(step) => {
            if (step < activeStep || validarPasso(activeStep)) {
              setActiveStep(step);
            }
          }}
        >
          <Step
            title="Prestador & Objeto"
            description="Identificação e serviço"
            icon={<Briefcase className="h-4 w-4" />}
          />
          <Step
            title="Vigência & Prazos"
            description="Datas e renovação"
            icon={<Calendar className="h-4 w-4" />}
          />
          <Step
            title="Valores & Reajuste"
            description="Preço, vencimento e índice"
            icon={<DollarSign className="h-4 w-4" />}
          />
          <Step
            title="Cláusulas & Revisão"
            description="Garantias e finalização"
            icon={<FileCheck2 className="h-4 w-4" />}
          />
        </Stepper>
      </Card>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Passo 1: Prestador e Objeto */}
        {activeStep === 1 && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
            <Section titulo="Condomínio e prestador">
              <Field label="Condomínio" required error={erros.condominio_id}>
                <Select
                  value={form.condominio_id ?? ""}
                  onValueChange={(v) => set("condominio_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o condomínio…" />
                  </SelectTrigger>
                  <SelectContent>
                    {condos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {c.cidade ? ` — ${c.cidade}${c.uf ? "/" + c.uf : ""}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nome do prestador" required error={erros.prestador_nome}>
                <Input
                  value={form.prestador_nome ?? ""}
                  onChange={(e) => set("prestador_nome", e.target.value)}
                  placeholder="Razão Social ou Nome do Prestador"
                  maxLength={200}
                />
              </Field>
              <Field label="CNPJ ou CPF">
                <Input
                  value={form.prestador_documento ?? ""}
                  onChange={(e) => set("prestador_documento", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={form.prestador_email ?? ""}
                  onChange={(e) => set("prestador_email", e.target.value)}
                  placeholder="contato@prestador.com.br"
                />
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.prestador_telefone ?? ""}
                  onChange={(e) => set("prestador_telefone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </Field>
            </Section>

            <Section titulo="Objeto e tipo de serviço">
              <Field label="Tipo de serviço">
                <Select value={form.tipo_servico_id ?? ""} onValueChange={handleTipoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Objeto do contrato" span2>
                <Textarea
                  value={form.objeto ?? ""}
                  onChange={(e) => set("objeto", e.target.value)}
                  rows={3}
                  placeholder="Descrição detalhada do escopo e serviços contratados"
                />
              </Field>
              <div className="sm:col-span-2 flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3.5">
                <Checkbox
                  id="terceirizacao"
                  checked={!!form.terceirizacao_mao_de_obra}
                  onCheckedChange={(v) => set("terceirizacao_mao_de_obra", !!v)}
                />
                <div className="grid gap-1">
                  <Label htmlFor="terceirizacao" className="cursor-pointer font-medium text-xs sm:text-sm">
                    Este contrato envolve terceirização de mão de obra alocada no condomínio
                    {tipoSelecionado?.terceirizacao_padrao ? (
                      <span className="ml-2 text-xs text-augusto-gold">(pré-marcado pelo tipo)</span>
                    ) : null}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ativa automaticamente a verificação de encargos trabalhistas (FGTS/INSS) e retenções tributárias.
                  </p>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* Passo 2: Vigência e Prazos */}
        {activeStep === 2 && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
            <Section titulo="Vigência e renovação">
              <Field label="Data de início">
                <Input
                  type="date"
                  value={form.data_inicio ?? ""}
                  onChange={(e) => set("data_inicio", e.target.value)}
                />
              </Field>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="prazo_indet"
                  checked={!!form.prazo_indeterminado}
                  onCheckedChange={(v) => {
                    set("prazo_indeterminado", !!v);
                    if (v) set("data_fim", null);
                  }}
                />
                <Label htmlFor="prazo_indet" className="cursor-pointer text-sm">
                  Prazo indeterminado
                </Label>
              </div>
              {!form.prazo_indeterminado && (
                <Field label="Data de fim" required error={erros.data_fim}>
                  <Input
                    type="date"
                    value={form.data_fim ?? ""}
                    onChange={(e) => set("data_fim", e.target.value)}
                  />
                </Field>
              )}
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="renov_auto"
                  checked={!!form.renovacao_automatica}
                  onCheckedChange={(v) => set("renovacao_automatica", !!v)}
                />
                <Label htmlFor="renov_auto" className="cursor-pointer text-sm">
                  Renovação automática
                </Label>
              </div>
              {form.renovacao_automatica ? (
                <Field label="Aviso prévio para não renovação (dias)">
                  <Input
                    type="number"
                    min={0}
                    value={form.aviso_previo_dias ?? ""}
                    onChange={(e) =>
                      set("aviso_previo_dias", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="Ex: 30 ou 60 dias"
                  />
                </Field>
              ) : null}
            </Section>
          </div>
        )}

        {/* Passo 3: Valores e Reajuste */}
        {activeStep === 3 && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
            <Section titulo="Valores e pagamento">
              <Field label="Valor (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor ?? ""}
                  onChange={(e) => set("valor", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Tipo de valor">
                <Select
                  value={form.tipo_valor ?? "mensal"}
                  onValueChange={(v) => set("tipo_valor", v as "mensal" | "global")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal (Recorrente)</SelectItem>
                    <SelectItem value="global">Global (Único)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Dia de vencimento" error={erros.dia_vencimento}>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dia_vencimento ?? ""}
                  onChange={(e) =>
                    set("dia_vencimento", e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="Ex: dia 10"
                />
              </Field>
            </Section>

            <Section titulo="Correção Monetária e Reajuste">
              <Field label="Índice de reajuste">
                <Select
                  value={form.indice_reajuste ?? "igpm"}
                  onValueChange={(v) =>
                    set("indice_reajuste", v as "igpm" | "ipca" | "inpc" | "outro" | "nenhum")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="igpm">IGP-M (FGV)</SelectItem>
                    <SelectItem value="ipca">IPCA (IBGE)</SelectItem>
                    <SelectItem value="inpc">INPC (IBGE)</SelectItem>
                    <SelectItem value="outro">Outro índice</SelectItem>
                    <SelectItem value="nenhum">Não há reajuste previsto</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mês base de reajuste">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.mes_base_reajuste ?? ""}
                  onChange={(e) =>
                    set("mes_base_reajuste", e.target.value === "" ? null : Number(e.target.value))
                  }
                  placeholder="Mês de aniversário (1 a 12)"
                />
              </Field>
            </Section>
          </div>
        )}

        {/* Passo 4: Cláusulas e Revisão Final */}
        {activeStep === 4 && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6">
            <Section titulo="Cláusulas e garantias contratuais">
              <Field label="Multa rescisória" span2>
                <Textarea
                  rows={2}
                  value={form.multa_rescisoria ?? ""}
                  onChange={(e) => set("multa_rescisoria", e.target.value)}
                  placeholder="Ex: 30% das parcelas vincendas até o término do contrato"
                />
              </Field>
              <div className="sm:col-span-2 flex items-center gap-2">
                <Checkbox
                  id="seguro_rc"
                  checked={!!form.exige_seguro_rc}
                  onCheckedChange={(v) => set("exige_seguro_rc", !!v)}
                />
                <Label htmlFor="seguro_rc" className="cursor-pointer text-sm">
                  Contrato exige apresentação de apólice de Seguro de Responsabilidade Civil
                </Label>
              </div>
              <Field label="Garantias contratuais" span2>
                <Textarea
                  rows={2}
                  value={form.garantias ?? ""}
                  onChange={(e) => set("garantias", e.target.value)}
                  placeholder="Ex: Caução, fiança bancária ou retenção de garantia"
                />
              </Field>
              <Field label="Foro de eleição">
                <Input
                  value={form.foro ?? ""}
                  onChange={(e) => set("foro", e.target.value)}
                  placeholder="Ex: Foro da Comarca de São Paulo/SP"
                />
              </Field>
            </Section>

            {/* Card de Revisão Resumida */}
            <Card className="p-4 border-augusto-gold/30 bg-gradient-to-br from-card to-augusto-gold/[0.03]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-augusto-gold mb-3 flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4" />
                Resumo da Ficha do Contrato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Condomínio:</span>{" "}
                  <strong className="text-foreground">{condominioSelecionado?.nome || "Não selecionado"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Prestador:</span>{" "}
                  <strong className="text-foreground">{form.prestador_nome || "—"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>{" "}
                  <strong className="text-foreground">
                    {form.valor ? `R$ ${Number(form.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${form.tipo_valor})` : "—"}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Vigência:</span>{" "}
                  <strong className="text-foreground">
                    {form.prazo_indeterminado ? "Prazo Indeterminado" : `${form.data_inicio || "—"} até ${form.data_fim || "—"}`}
                  </strong>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Barra de Ações do Stepper (Voltar / Avançar / Salvar) */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            {activeStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVoltar}
                disabled={salvando}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeStep < 4 ? (
              <Button
                type="button"
                variant="augusto"
                size="sm"
                onClick={handleAvancar}
              >
                Avançar <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" variant="augusto" size="sm" disabled={salvando}>
                <Check className="mr-1.5 h-4 w-4" />
                {salvando ? "Salvando…" : submitLabel}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {titulo}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
  span2,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2 grid gap-1.5" : "grid gap-1.5"}>
      <Label className="text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}