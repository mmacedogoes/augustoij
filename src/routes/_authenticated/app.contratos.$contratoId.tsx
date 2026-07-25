import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, FileText, ExternalLink, Upload, Sparkles } from "lucide-react";
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
import { AgendaPanel } from "@/components/contratos-servico/AgendaPanel";
import { ResponsaveisPanel } from "@/components/contratos-servico/ResponsaveisPanel";
import { AvisosSwitch } from "@/components/contratos-servico/AvisosSwitch";
import { ReajustesPanel } from "@/components/contratos-servico/ReajustesPanel";
import { AditivosPanel } from "@/components/contratos-servico/AditivosPanel";
import { AnalisePanel } from "@/components/contratos-servico/AnalisePanel";
import { AtividadesPanel } from "@/components/contratos-servico/AtividadesPanel";
import { EncerrarSuspenderMenu } from "@/components/contratos-servico/EncerrarSuspenderMenu";
import { Badge } from "@/components/ui/badge";
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
  const [countAditivos, setCountAditivos] = useState<number>(0);
  const [aba, setAba] = useState<string>("obrigacoes");

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
  const temArquivo = !!(c.arquivo_path || c.documento_id);

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
            <AvisosSwitch
              contratoId={contratoId}
              ativo={!!c.notificacoes_ativas}
              onChange={(v) => setFicha((prev) => (prev ? { ...prev, contrato: { ...prev.contrato, notificacoes_ativas: v } } : prev))}
            />
            <Button
              variant="default"
              onClick={() => {
                setAba("analise");
                if (!temArquivo) {
                  toast.info("Anexe o arquivo do contrato para gerar a análise.");
                }
              }}
              disabled={!temArquivo}
              title={temArquivo ? "Analisar com Augusto" : "Anexe o arquivo do contrato para gerar a análise"}
            >
              <Sparkles className="h-4 w-4 mr-1" /> Analisar com Augusto
            </Button>
            <EncerrarSuspenderMenu contratoId={contratoId} situacao={c.situacao} onChange={carregar} />
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

        {countAditivos > 0 && (
          <div className="mb-4">
            <Badge variant="secondary">{countAditivos} {countAditivos === 1 ? "aditivo" : "aditivos"}</Badge>
          </div>
        )}

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

        <Tabs value={aba} onValueChange={setAba} className="mb-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
            <TabsTrigger value="retencoes">Retenções</TabsTrigger>
            <TabsTrigger value="checklists">Checklists</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="reajustes">Reajustes</TabsTrigger>
            <TabsTrigger value="aditivos">Aditivos</TabsTrigger>
            <TabsTrigger value="analise">Análise</TabsTrigger>
            <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
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
          <TabsContent value="agenda" className="mt-4">
            <AgendaPanel contratoId={contratoId} />
          </TabsContent>
          <TabsContent value="reajustes" className="mt-4">
            <ReajustesPanel
              contrato={{
                id: contratoId,
                valor: c.valor === null ? null : Number(c.valor),
                indice_reajuste: c.indice_reajuste,
                mes_base_reajuste: c.mes_base_reajuste,
                ultimo_reajuste_em: c.ultimo_reajuste_em,
                situacao: c.situacao,
              }}
              onChange={carregar}
            />
          </TabsContent>
          <TabsContent value="responsaveis" className="mt-4">
            <ResponsaveisPanel contratoId={contratoId} />
          </TabsContent>
          <TabsContent value="aditivos" className="mt-4">
            <AditivosPanel contratoId={contratoId} onCountChange={setCountAditivos} />
          </TabsContent>
          <TabsContent value="analise" className="mt-4">
            <AnalisePanel
              contratoId={contratoId}
              temArquivo={temArquivo}
              condominioId={c.condominio_id}
              prestadorNome={c.prestador_nome}
              objeto={c.objeto ?? null}
            />
          </TabsContent>
          <TabsContent value="atividades" className="mt-4">
            <AtividadesPanel contratoId={contratoId} />
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

function Bloco({ titulo, icon, children }: { titulo: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-4 transition-shadow duration-200 hover:shadow-sm">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon ? <span className="text-augusto-gold">{icon}</span> : null}
        {titulo}
      </p>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </Card>
  );
}

function TriggerIcon({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-augusto-gold/25 gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-foreground"
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </TabsTrigger>
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