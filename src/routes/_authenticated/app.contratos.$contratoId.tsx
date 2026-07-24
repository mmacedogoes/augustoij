import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, FileText, ExternalLink, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContratoStatusBadge } from "@/components/contratos-servico/ContratoStatusBadge";
import {
  ObrigacoesEditor,
  type Obrigacao,
} from "@/components/contratos-servico/ObrigacoesEditor";
import { RetencoesCard } from "@/components/contratos-servico/RetencoesCard";
import { ChecklistsPanel } from "@/components/contratos-servico/ChecklistsPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getContratoServico,
  removeContratoServico,
} from "@/lib/contratos-servico/contratos.functions";
import {
  getContratoArquivoUrl,
  anexarArquivoContratoServico,
} from "@/lib/contratos-servico/importar.functions";
import { statusExibicaoContrato } from "@/lib/contratos-servico/status";

export const Route = createFileRoute("/_authenticated/app/contratos/$contratoId")({
  component: Page,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ficha = { contrato: any; obrigacoes: Obrigacao[] };

function Page() {
  const { contratoId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getContratoServico);
  const removerFn = useServerFn(removeContratoServico);
  const arquivoFn = useServerFn(getContratoArquivoUrl);
  const anexarFn = useServerFn(anexarArquivoContratoServico);
  const [abrindoArquivo, setAbrindoArquivo] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(() => {
    setErro(null);
    getFn({ data: { id: contratoId } })
      .then((r) => setFicha(r as Ficha))
      .catch((e: Error) => {
        setErro(e.message);
        toast.error(e.message);
      });
  }, [getFn, contratoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleExcluir() {
    setExcluindo(true);
    try {
      await removerFn({ data: { id: contratoId } });
      toast.success("Contrato excluído");
      navigate({ to: "/app/contratos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir");
    } finally {
      setExcluindo(false);
      setConfirmar(false);
    }
  }

  async function abrirArquivo() {
    setAbrindoArquivo(true);
    try {
      const r = await arquivoFn({ data: { id: contratoId } });
      if (!r.url) {
        toast.info("Este contrato não possui arquivo vinculado.");
        return;
      }
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    } finally {
      setAbrindoArquivo(false);
    }
  }

  async function handleAnexarArquivo(f: File) {
    const MAX_MB = 10;
    if (f.size === 0) { toast.error("Arquivo vazio."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo grande demais (máx. ${MAX_MB} MB).`); return; }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".doc") && !lower.endsWith(".txt")) {
      toast.error("Formato não suportado. Envie PDF, DOCX ou TXT.");
      return;
    }
    setAnexando(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        r.onload = () => {
          const s = String(r.result ?? "");
          resolve(s.includes(",") ? s.split(",", 2)[1] : s);
        };
        r.readAsDataURL(f);
      });
      await anexarFn({
        data: {
          id: contratoId,
          fileBase64: b64,
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
        },
      });
      toast.success("Arquivo anexado.");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível anexar o arquivo.");
    } finally {
      setAnexando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (erro) {
    return (
      <AppShell>
        <div className="max-w-4xl">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate({ to: "/app/contratos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </AppShell>
    );
  }
  if (!ficha) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando contrato…</p>
      </AppShell>
    );
  }

  const c = ficha.contrato;
  const status = statusExibicaoContrato(c);

  return (
    <AppShell>
      <div className="max-w-4xl">
        <Link to="/app/contratos" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Contratos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <p className="app-eyebrow">
              {c.tipos_servico_contrato?.nome ?? "Contrato de prestação de serviços"}
            </p>
            <h1 className="text-3xl font-serif text-primary">{c.prestador_nome}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              {c.condominios?.nome ?? "Condomínio"} <ContratoStatusBadge status={status} />
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/app/contratos/$contratoId/editar",
                  params: { contratoId },
                })
              }
            >
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button variant="destructive" onClick={() => setConfirmar(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Card className="p-4 sm:col-span-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Arquivo do contrato</p>
                <p className="text-xs text-muted-foreground">
                  {c.arquivo_path
                    ? "Enviado na importação"
                    : c.documento_id
                      ? "Vinculado ao acervo do condomínio"
                      : "Nenhum arquivo vinculado. Anexe um PDF, DOCX ou TXT (até 10 MB)."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAnexarArquivo(f);
                }}
              />
              {c.arquivo_path || c.documento_id ? (
                <Button variant="outline" size="sm" onClick={abrirArquivo} disabled={abrindoArquivo}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {abrindoArquivo ? "Abrindo…" : "Abrir arquivo"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={anexando}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {anexando ? "Enviando…" : "Anexar arquivo"}
                </Button>
              )}
            </div>
          </Card>
          <Bloco titulo="Prestador">
            <Item label="Nome" value={c.prestador_nome} />
            <Item label="CNPJ/CPF" value={c.prestador_documento} />
            <Item label="E-mail" value={c.prestador_email} />
            <Item label="Telefone" value={c.prestador_telefone} />
          </Bloco>
          <Bloco titulo="Objeto e tipo">
            <Item label="Tipo" value={c.tipos_servico_contrato?.nome} />
            <Item label="Objeto" value={c.objeto} />
            <Item
              label="Terceirização de mão de obra"
              value={c.terceirizacao_mao_de_obra ? "Sim" : "Não"}
            />
          </Bloco>
          <Bloco titulo="Vigência e renovação">
            <Item label="Início" value={formatDate(c.data_inicio)} />
            <Item
              label="Fim"
              value={c.prazo_indeterminado ? "Indeterminado" : formatDate(c.data_fim)}
            />
            <Item label="Renovação automática" value={c.renovacao_automatica ? "Sim" : "Não"} />
            {c.renovacao_automatica ? (
              <Item label="Aviso prévio (dias)" value={c.aviso_previo_dias} />
            ) : null}
          </Bloco>
          <Bloco titulo="Valores e pagamento">
            <Item
              label="Valor"
              value={
                c.valor === null
                  ? "—"
                  : `${formatBRL(Number(c.valor))} ${c.tipo_valor === "mensal" ? "/mês" : "(global)"}`
              }
            />
            <Item label="Dia de vencimento" value={c.dia_vencimento ?? "—"} />
          </Bloco>
          <Bloco titulo="Reajuste">
            <Item label="Índice" value={rotuloIndice(c.indice_reajuste)} />
            <Item label="Mês base" value={c.mes_base_reajuste ?? "—"} />
          </Bloco>
          <Bloco titulo="Cláusulas">
            <Item label="Multa rescisória" value={c.multa_rescisoria} />
            <Item label="Exige seguro RC" value={c.exige_seguro_rc ? "Sim" : "Não"} />
            <Item label="Garantias" value={c.garantias} />
            <Item label="Foro" value={c.foro} />
          </Bloco>
        </div>

        <Tabs defaultValue="obrigacoes" className="mb-6">
          <TabsList>
            <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
            <TabsTrigger value="retencoes">Retenções</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
          </TabsList>
          <TabsContent value="obrigacoes" className="mt-4">
            <Card className="p-4">
              <div className="mb-4">
                <h3 className="text-lg font-serif text-primary">Obrigações do contrato</h3>
                <p className="text-sm text-muted-foreground">
                  Mapa de obrigações do contrato (edição manual ou importação por IA).
                </p>
              </div>
              <ObrigacoesEditor
                contratoId={contratoId}
                itens={ficha.obrigacoes}
                onChange={carregar}
              />
            </Card>
          </TabsContent>
          <TabsContent value="retencoes" className="mt-4">
            <RetencoesCard contratoId={contratoId} />
          </TabsContent>
          <TabsContent value="checklists" className="mt-4">
            <ChecklistsPanel contratoId={contratoId} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir contrato?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todas as obrigações vinculadas a este contrato também serão removidas. Esta ação não
            pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
              {excluindo ? "Excluindo…" : "Excluir contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{titulo}</p>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </Card>
  );
}
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function rotuloIndice(i: string | null | undefined): string {
  switch (i) {
    case "igpm":
      return "IGP-M";
    case "ipca":
      return "IPCA";
    case "inpc":
      return "INPC";
    case "outro":
      return "Outro";
    case "nenhum":
      return "Não há";
    default:
      return "—";
  }
}