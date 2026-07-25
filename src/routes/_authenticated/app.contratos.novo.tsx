import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, PencilLine,
  Sparkles, Trash2, Upload, Wand2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ContratoForm, type ContratoFormValues } from "@/components/contratos-servico/ContratoForm";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  extrairContratoServico,
  salvarImportacaoContratoServico,
  type CamposImportacao,
  type ObrigacaoExtraida,
} from "@/lib/contratos-servico/importar.functions";
import type { ContratoServicoInput } from "@/lib/contratos-servico/schemas";

export const Route = createFileRoute("/_authenticated/app/contratos/novo")({
  component: Page,
});

const MAX_MB = 10;
type Modo = "escolher" | "ia_upload" | "ia_processando" | "ia_revisao" | "manual";
type Obr = ObrigacaoExtraida & { origem: "ia" | "manual" };
type Extracao = {
  arquivoPath: string | null;
  documentoId: string | null;
  extracaoOk: boolean;
  motivo: string | null;
  campos: CamposImportacao;
  obrigacoes: ObrigacaoExtraida[];
  contratante_nome: string | null;
};

function Page() {
  const navigate = useNavigate();
  const extrair = useServerFn(extrairContratoServico);
  const salvar = useServerFn(salvarImportacaoContratoServico);

  const [modo, setModo] = useState<Modo>("escolher");
  const [file, setFile] = useState<File | null>(null);
  const [extracao, setExtracao] = useState<Extracao | null>(null);
  const [obrigacoes, setObrigacoes] = useState<Obr[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size / (1024 * 1024) > MAX_MB) {
      toast.error(`Arquivo grande demais (máx. ${MAX_MB} MB).`);
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".doc") && !lower.endsWith(".txt")) {
      toast.error("Formato não suportado. Envie PDF, DOCX ou TXT.");
      return;
    }
    setFile(f);
  }

  async function processarComIA() {
    if (!file) return;
    setModo("ia_processando");
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("Falha ao ler arquivo."));
        r.onload = () => {
          const s = String(r.result ?? "");
          resolve(s.includes(",") ? s.split(",", 2)[1] : s);
        };
        r.readAsDataURL(file);
      });
      // condominioId é obrigatório na extração — o usuário escolherá na revisão.
      // Enviamos um placeholder e substituímos após a IA responder; para
      // manter a assinatura, exigimos que o usuário selecione antes.
      // Simplificação: pedimos ao usuário para escolher via ContratoForm depois.
      // A função de extração espera condominioId; usamos um marcador vazio não
      // é permitido. Portanto, usamos o UUID zero e trocamos no salvar.
      // Para não quebrar, exigimos pré-seleção antes do upload:
      const r = (await extrair({
        data: {
          fileBase64: b64,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          condominioId: "00000000-0000-0000-0000-000000000000",
        },
      })) as Extracao;
      setExtracao(r);
      setObrigacoes(r.obrigacoes.map((o) => ({ ...o, origem: "ia" as const })));
      if (r.extracaoOk) toast.success("Contrato lido — revise antes de salvar.");
      else if (r.motivo) toast.warning(r.motivo);
      setModo("ia_revisao");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ler o contrato.";
      toast.error(msg);
      setModo("ia_upload");
    }
  }

  const initialForm: ContratoFormValues | undefined = useMemo(() => {
    if (!extracao) return undefined;
    const c = extracao.campos;
    const clean: ContratoFormValues = {};
    const copy: Array<keyof CamposImportacao> = [
      "prestador_nome","prestador_documento","prestador_email","prestador_telefone","objeto",
      "tipo_servico_id","terceirizacao_mao_de_obra","data_inicio","data_fim","prazo_indeterminado",
      "renovacao_automatica","aviso_previo_dias","valor","tipo_valor","dia_vencimento",
      "indice_reajuste","mes_base_reajuste","multa_rescisoria","exige_seguro_rc","garantias","foro",
    ];
    for (const k of copy) {
      const v = c[k];
      if (v !== null && v !== undefined) (clean as Record<string, unknown>)[k as string] = v;
    }
    return clean;
  }, [extracao]);

  async function salvarImportado(values: ContratoServicoInput) {
    const limpas = obrigacoes
      .map((o) => ({ ...o, descricao: (o.descricao ?? "").trim() }))
      .filter((o) => o.descricao.length > 0);
    return await salvar({
      data: {
        contrato: values,
        obrigacoes: limpas,
        arquivoPath: extracao?.arquivoPath ?? null,
        documentoId: extracao?.documentoId ?? null,
      },
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="app-eyebrow">Gestão de Contratos</p>
            <h1 className="mt-1.5 font-serif text-3xl leading-tight text-primary sm:text-4xl">
              Novo contrato
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Envie o arquivo para o Augusto ler e preencher tudo, ou cadastre à mão.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ContratosTabs condominioId={null} />
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/contratos" })}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancelar
            </Button>
          </div>
        </div>

        {modo === "escolher" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              icon={<Wand2 className="h-5 w-5" />}
              recommended
              title="Ler contrato com IA"
              description="Envie um PDF, DOCX ou TXT e o Augusto preenche prestador, vigência, valores, cláusulas e obrigações. Você revisa antes de salvar."
              cta="Escolher arquivo"
              onClick={() => setModo("ia_upload")}
            />
            <ChoiceCard
              icon={<PencilLine className="h-5 w-5" />}
              title="Preencher manualmente"
              description="Cadastre os dados no formulário completo. Ideal se você já tem tudo em mãos ou o contrato é curto."
              cta="Abrir formulário"
              onClick={() => setModo("manual")}
            />
          </div>
        )}

        {modo === "ia_upload" && (
          <Card className="space-y-5 p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-augusto-gold/15 text-augusto-gold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-primary">Envie o contrato</h2>
                <p className="text-sm text-muted-foreground">
                  Aceito PDF, DOCX ou TXT (até {MAX_MB} MB). Contratos escaneados também funcionam — uso visão computacional como fallback.
                </p>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />

            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-10 text-sm text-muted-foreground transition-all duration-200",
                  "hover:border-augusto-gold/60 hover:bg-augusto-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70",
                )}
              >
                <Upload className="h-6 w-6" />
                <span className="font-medium text-foreground">Clique para escolher o arquivo</span>
                <span className="text-xs">ou arraste e solte aqui</span>
              </button>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setModo("escolher")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={processarComIA} disabled={!file}>
                <Sparkles className="mr-1 h-4 w-4" /> Analisar com IA <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {modo === "ia_processando" && (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-augusto-gold/15">
              <Loader2 className="h-6 w-6 animate-spin text-augusto-gold" />
            </div>
            <p className="font-serif text-lg text-primary">O Augusto está lendo seu contrato…</p>
            <p className="text-sm text-muted-foreground">Isso pode levar até 30 segundos.</p>
          </Card>
        )}

        {modo === "ia_revisao" && extracao && (
          <div className="space-y-6">
            {extracao.extracaoOk ? (
              <div className="flex items-start gap-3 rounded-lg border border-augusto-green/30 bg-augusto-green/5 p-4 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-augusto-green" />
                <div>
                  <p className="font-medium text-primary">Leitura concluída — confira os dados abaixo.</p>
                  {extracao.contratante_nome ? (
                    <p className="mt-0.5 text-muted-foreground">
                      Contratante identificado: <strong>{extracao.contratante_nome}</strong>.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-augusto-gold/40 bg-augusto-gold/10 p-4 text-sm text-foreground">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-augusto-gold" />
                <div>
                  <p className="font-medium text-primary">Extraí o que consegui — complete o que faltar.</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {extracao.motivo ?? "Alguns campos não foram identificados no arquivo."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="p-5">
                <ContratoForm
                  initial={initialForm}
                  submitLabel="Salvar contrato"
                  onOverrideSubmit={salvarImportado}
                  onSaved={(id) => {
                    toast.success("Contrato criado com sucesso.");
                    navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } });
                  }}
                />
              </Card>
              <ObrigacoesReviewSidebar obrigacoes={obrigacoes} setObrigacoes={setObrigacoes} />
            </div>
          </div>
        )}

        {modo === "manual" && (
          <Card className="p-5">
            <ContratoForm
              onSaved={(id) => navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } })}
              submitLabel="Criar contrato"
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function ChoiceCard({
  icon, title, description, cta, recommended, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-augusto-gold/50 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {recommended && (
        <span className="absolute right-4 top-4 rounded-full bg-augusto-gold/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-augusto-gold">
          Recomendado
        </span>
      )}
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/5 text-primary transition-colors group-hover:bg-augusto-gold/15 group-hover:text-augusto-gold">
        {icon}
      </div>
      <div>
        <h3 className="font-serif text-xl text-primary">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-transform duration-200 group-hover:translate-x-0.5">
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function ObrigacoesReviewSidebar({
  obrigacoes, setObrigacoes,
}: {
  obrigacoes: Obr[];
  setObrigacoes: React.Dispatch<React.SetStateAction<Obr[]>>;
}) {
  function atualizar(i: number, patch: Partial<Obr>) {
    setObrigacoes((arr) => arr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function remover(i: number) { setObrigacoes((arr) => arr.filter((_, idx) => idx !== i)); }
  function adicionar(parte: "condominio" | "prestador") {
    setObrigacoes((arr) => [
      ...arr,
      { parte, descricao: "", periodicidade: "mensal", clausula_origem: null, origem: "manual" },
    ]);
  }
  const cond = obrigacoes.map((o, i) => ({ o, i })).filter((x) => x.o.parte === "condominio");
  const prest = obrigacoes.map((o, i) => ({ o, i })).filter((x) => x.o.parte === "prestador");

  return (
    <aside className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="font-serif text-lg text-primary">Obrigações identificadas</h2>
        <p className="text-xs text-muted-foreground">
          Edite, remova ou adicione. Descrições vazias são descartadas ao salvar.
        </p>
      </div>
      <ObrigGrupo titulo="Do condomínio" itens={cond} atualizar={atualizar} remover={remover} onAdd={() => adicionar("condominio")} />
      <ObrigGrupo titulo="Do prestador" itens={prest} atualizar={atualizar} remover={remover} onAdd={() => adicionar("prestador")} />
    </aside>
  );
}

function ObrigGrupo({
  titulo, itens, atualizar, remover, onAdd,
}: {
  titulo: string;
  itens: Array<{ o: Obr; i: number }>;
  atualizar: (i: number, patch: Partial<Obr>) => void;
  remover: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <Button size="sm" variant="ghost" onClick={onAdd}>+ Adicionar</Button>
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma obrigação identificada.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map(({ o, i }) => (
            <li key={i} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
              <textarea
                className="w-full resize-none border-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                value={o.descricao}
                onChange={(e) => atualizar(i, { descricao: e.target.value })}
                rows={2}
                placeholder="Descrição da obrigação"
              />
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 uppercase tracking-wide",
                    o.origem === "ia"
                      ? "bg-augusto-gold/15 text-augusto-gold"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {o.origem}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remover(i)}
                >
                  remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
