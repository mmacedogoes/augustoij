/**
 * Wizard de importação de contratos de prestação de serviços com IA.
 *
 * 3 passos: (1) origem — condomínio + upload OU documento do acervo;
 * (2) processamento — feedback com skeleton e estados de erro;
 * (3) revisão — formulário Fase 1 pré-preenchido + bloco de obrigações
 * editável em 2 colunas. Nada é salvo até o usuário confirmar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Upload, FileText, ArrowLeft, Sparkles, Trash2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { ContratoForm, type ContratoFormValues } from "@/components/contratos-servico/ContratoForm";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { listCondominiosParaContratos } from "@/lib/contratos-servico/contratos.functions";
import {
  extrairContratoServico,
  extrairContratoDeDocumento,
  listDocumentosContratoDoCondominio,
  salvarImportacaoContratoServico,
  type CamposImportacao,
  type ObrigacaoExtraida,
} from "@/lib/contratos-servico/importar.functions";
import type { ContratoServicoInput } from "@/lib/contratos-servico/schemas";

export const Route = createFileRoute("/_authenticated/app/contratos/importar")({
  component: Page,
});

const MAX_MB = 10;

type Condo = { id: string; nome: string; cidade: string | null; uf: string | null };
type Doc = { id: string; titulo: string | null; nome_arquivo: string | null; created_at: string };

type Extracao = {
  arquivoPath: string | null;
  documentoId: string | null;
  extracaoOk: boolean;
  motivo: string | null;
  campos: CamposImportacao;
  obrigacoes: ObrigacaoExtraida[];
  contratante_nome: string | null;
};

type Passo = "origem" | "processando" | "revisao";

function Page() {
  const navigate = useNavigate();
  const listarCondos = useServerFn(listCondominiosParaContratos);
  const listarDocs = useServerFn(listDocumentosContratoDoCondominio);
  const extrair = useServerFn(extrairContratoServico);
  const extrairDoc = useServerFn(extrairContratoDeDocumento);
  const salvar = useServerFn(salvarImportacaoContratoServico);

  const [passo, setPasso] = useState<Passo>("origem");
  const [condos, setCondos] = useState<Condo[] | null>(null);
  const [condominioId, setCondominioId] = useState<string>("");
  const [fonte, setFonte] = useState<"upload" | "acervo">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [docId, setDocId] = useState<string>("");
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [erroProcesso, setErroProcesso] = useState<string | null>(null);
  const [extracao, setExtracao] = useState<Extracao | null>(null);
  const [obrigacoes, setObrigacoes] = useState<Array<ObrigacaoExtraida & { origem: "ia" | "manual" }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alivo = true;
    listarCondos()
      .then((r) => alivo && setCondos((r.rows as Condo[]) ?? []))
      .catch((e: Error) => alivo && setErroInicial(e.message));
    return () => { alivo = false; };
  }, [listarCondos]);

  useEffect(() => {
    if (fonte !== "acervo" || !condominioId) { setDocs(null); return; }
    setCarregandoDocs(true);
    setDocs(null);
    listarDocs({ data: { condominioId } })
      .then((r) => setDocs((r.rows as Doc[]) ?? []))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setCarregandoDocs(false));
  }, [fonte, condominioId, listarDocs]);

  function selecionarArquivo(f: File | null) {
    if (!f) { setFile(null); return; }
    const mb = f.size / (1024 * 1024);
    if (mb > MAX_MB) {
      toast.error(`Arquivo grande demais (máx. ${MAX_MB} MB).`);
      return;
    }
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".pdf") && !ext.endsWith(".docx") && !ext.endsWith(".doc") && !ext.endsWith(".txt")) {
      toast.error("Formato não suportado. Envie PDF, DOCX ou TXT.");
      return;
    }
    setFile(f);
  }

  async function processar() {
    if (!condominioId) { toast.error("Selecione um condomínio."); return; }
    if (fonte === "upload" && !file) { toast.error("Selecione um arquivo."); return; }
    if (fonte === "acervo" && !docId) { toast.error("Escolha um documento do acervo."); return; }

    setErroProcesso(null);
    setPasso("processando");
    try {
      let r: Extracao;
      if (fonte === "upload" && file) {
        const b64 = await lerBase64(file);
        r = (await extrair({
          data: { fileBase64: b64, fileName: file.name, mimeType: file.type || "application/octet-stream", condominioId },
        })) as Extracao;
      } else {
        r = (await extrairDoc({ data: { documentoId: docId, condominioId } })) as Extracao;
      }
      setExtracao(r);
      setObrigacoes(r.obrigacoes.map((o) => ({ ...o, origem: "ia" as const })));
      if (!r.extracaoOk && r.motivo) toast.warning(r.motivo);
      else toast.success("Extração concluída — revise antes de salvar.");
      setPasso("revisao");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na importação.";
      setErroProcesso(msg);
      toast.error(msg);
      setPasso("origem");
    }
  }

  const initialForm: ContratoFormValues | undefined = useMemo(() => {
    if (!extracao) return undefined;
    const c = extracao.campos;
    const clean: ContratoFormValues = { condominio_id: condominioId };
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
  }, [extracao, condominioId]);

  async function salvarTudo(values: ContratoServicoInput) {
    // Validação leve das obrigações — descrição obrigatória.
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

  if (erroInicial) {
    return (
      <AppShell>
        <div className="max-w-3xl">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erroInicial}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl space-y-6">
        <ContratosTabs condominioId={condominioId || null} />
        <div className="flex items-start justify-between gap-3">
          <header className="app-page-header">
            <span className="app-eyebrow">Contratos</span>
            <h1 className="app-title">Importar contrato com IA</h1>
            <p className="app-subtitle">
              A IA lê o arquivo e sugere os campos e obrigações. Nada é salvo sem sua confirmação.
            </p>
          </header>
          <Button variant="outline" onClick={() => navigate({ to: "/app/contratos" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>

        <StepIndicator passo={passo} />

        {passo === "origem" && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <div>
              <Label>Condomínio</Label>
              {!condos ? (
                <div className="mt-2"><AppSkeletonLines lines={2} /></div>
              ) : condos.length === 0 ? (
                <div className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Cadastre um condomínio antes de importar contratos.
                </div>
              ) : (
                <Select value={condominioId} onValueChange={setCondominioId}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {condos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.cidade ? ` — ${c.cidade}${c.uf ? "/" + c.uf : ""}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Fonte do arquivo</Label>
              <RadioGroup value={fonte} onValueChange={(v) => setFonte(v as "upload" | "acervo")} className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
                  <RadioGroupItem value="upload" id="fonte-upload" />
                  <div>
                    <div className="font-medium">Enviar um arquivo novo</div>
                    <div className="text-xs text-muted-foreground">PDF, DOCX ou TXT (até {MAX_MB} MB)</div>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
                  <RadioGroupItem value="acervo" id="fonte-acervo" />
                  <div>
                    <div className="font-medium">Usar documento do acervo</div>
                    <div className="text-xs text-muted-foreground">Contratos já enviados nos Documentos do condomínio</div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {fonte === "upload" ? (
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                  className="hidden"
                  onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium">{file.name}</span>
                      <span className="text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground transition hover:bg-muted/40">
                    <Upload className="h-6 w-6" />
                    Clique para escolher o arquivo do contrato
                  </button>
                )}
              </div>
            ) : (
              <div>
                <Label>Documento</Label>
                {!condominioId ? (
                  <div className="mt-2 text-sm text-muted-foreground">Selecione um condomínio para listar os documentos.</div>
                ) : carregandoDocs ? (
                  <div className="mt-2"><AppSkeletonLines lines={2} /></div>
                ) : !docs || docs.length === 0 ? (
                  <div className="mt-2 rounded-md border border-border bg-muted/40">
                    <AppEmptyState
                      title="Nenhum contrato encontrado"
                      description="Não há documentos no acervo deste condomínio."
                    />
                  </div>
                ) : (
                  <Select value={docId} onValueChange={setDocId}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha um documento…" /></SelectTrigger>
                    <SelectContent>
                      {docs.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.titulo ?? d.nome_arquivo ?? "Documento sem título"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {erroProcesso && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {erroProcesso}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={processar} disabled={!condominioId || (fonte === "upload" ? !file : !docId)}>
                <Sparkles className="mr-2 h-4 w-4" /> Analisar com IA
              </Button>
            </div>
          </div>
        )}

        {passo === "processando" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-12 text-center shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-lg font-medium">Analisando o contrato…</div>
            <div className="text-sm text-muted-foreground">Isso pode levar até 30 segundos.</div>
          </div>
        )}

        {passo === "revisao" && extracao && (
          <div className="space-y-6">
            {extracao.extracaoOk ? (
              <div className="flex items-start gap-2 rounded-md border border-augusto-green/30 bg-augusto-green/5 p-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-medium">Extração concluída.</div>
                  <div>
                    Revise os campos abaixo e as obrigações identificadas.{" "}
                    {extracao.contratante_nome ? <>Contratante lido: <strong>{extracao.contratante_nome}</strong>.</> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-medium">Não consegui extrair automaticamente.</div>
                  <div>{extracao.motivo ?? "Preencha os campos manualmente."} O arquivo foi salvo e ficará vinculado ao contrato.</div>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <ContratoForm
                initial={initialForm}
                submitLabel="Salvar contrato importado"
                onOverrideSubmit={salvarTudo}
                onSaved={(id) => {
                  toast.success("Contrato importado com sucesso.");
                  navigate({ to: "/app/contratos/$contratoId", params: { contratoId: id } });
                }}
              />

              <ObrigacoesEditor obrigacoes={obrigacoes} setObrigacoes={setObrigacoes} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StepIndicator({ passo }: { passo: Passo }) {
  const passos: Array<{ k: Passo; label: string }> = [
    { k: "origem", label: "1. Origem" },
    { k: "processando", label: "2. Processamento" },
    { k: "revisao", label: "3. Revisão" },
  ];
  const idx = passos.findIndex((p) => p.k === passo);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {passos.map((p, i) => (
        <div key={p.k} className="flex items-center gap-2">
          <span className={i <= idx ? "font-medium text-foreground" : ""}>{p.label}</span>
          {i < passos.length - 1 && <span>›</span>}
        </div>
      ))}
    </div>
  );
}

type Obr = ObrigacaoExtraida & { origem: "ia" | "manual" };

function ObrigacoesEditor({
  obrigacoes,
  setObrigacoes,
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
    <aside className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="font-serif text-lg text-primary">Obrigações</h2>
        <p className="text-xs text-muted-foreground">Ajuste, remova ou adicione obrigações identificadas pela IA.</p>
      </div>

      <ColunaObrigacoes titulo="Do condomínio" items={cond} onAdd={() => adicionar("condominio")} onEdit={atualizar} onRemove={remover} />
      <ColunaObrigacoes titulo="Do prestador" items={prest} onAdd={() => adicionar("prestador")} onEdit={atualizar} onRemove={remover} />
    </aside>
  );
}

function ColunaObrigacoes({
  titulo, items, onAdd, onEdit, onRemove,
}: {
  titulo: string;
  items: Array<{ o: Obr; i: number }>;
  onAdd: () => void;
  onEdit: (i: number, patch: Partial<Obr>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{titulo}</h3>
        <Button size="sm" variant="ghost" onClick={onAdd}><Plus className="mr-1 h-3 w-3" />Adicionar</Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma obrigação identificada. Você pode adicionar manualmente.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(({ o, i }) => (
            <li key={i} className="space-y-2 rounded-md border border-border p-2">
              <Textarea
                value={o.descricao}
                onChange={(e) => onEdit(i, { descricao: e.target.value })}
                rows={2}
                placeholder="Descrição da obrigação"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={o.periodicidade} onValueChange={(v) => onEdit(i, { periodicidade: v as Obr["periodicidade"] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="por_evento">Por evento</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={o.clausula_origem ?? ""}
                  onChange={(e) => onEdit(i, { clausula_origem: e.target.value || null })}
                  placeholder="Cláusula (opcional)"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {o.origem === "ia" ? "Sugerida pela IA" : "Adicionada por você"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => onRemove(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function lerBase64(f: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(f);
  });
}
