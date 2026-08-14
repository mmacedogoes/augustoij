import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, Trash2, FileText, ExternalLink, Upload, Sparkles,
  Building2, Briefcase, CalendarRange, Wallet, TrendingUp, Scale,
  ClipboardCheck, ListChecks, Shield, CalendarClock, ArrowUpRightSquare,
  FilePlus2, Users, Activity, Check, X, Mail, Phone, Hash, CalendarDays,
  Landmark, Percent, ScrollText, MessageSquare, ChevronDown, ChevronUp
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExpandableText } from "@/components/contratos-servico/ExpandableText";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
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
import { AvisosSwitch } from "@/components/contratos-servico/AvisosSwitch";
import { AppSkeleton, AppSkeletonLines } from "@/components/ui/app-skeleton";
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
import { EditContratoModal } from "@/components/contratos-servico/EditContratoModal";
import { EditObrigacoesModal } from "@/components/contratos-servico/EditObrigacoesModal";
import { Separator } from "@/components/ui/separator";

// Painéis pesados só carregam quando a aba correspondente é aberta.
const RetencoesCard = lazy(() =>
  import("@/components/contratos-servico/RetencoesCard").then((m) => ({ default: m.RetencoesCard })),
);
const ChecklistsPanel = lazy(() =>
  import("@/components/contratos-servico/ChecklistsPanel").then((m) => ({ default: m.ChecklistsPanel })),
);
const AgendaPanel = lazy(() =>
  import("@/components/contratos-servico/AgendaPanel").then((m) => ({ default: m.AgendaPanel })),
);
const ResponsaveisPanel = lazy(() =>
  import("@/components/contratos-servico/ResponsaveisPanel").then((m) => ({ default: m.ResponsaveisPanel })),
);
const ReajustesPanel = lazy(() =>
  import("@/components/contratos-servico/ReajustesPanel").then((m) => ({ default: m.ReajustesPanel })),
);
const AditivosPanel = lazy(() =>
  import("@/components/contratos-servico/AditivosPanel").then((m) => ({ default: m.AditivosPanel })),
);
const AnalisePanel = lazy(() =>
  import("@/components/contratos-servico/AnalisePanel").then((m) => ({ default: m.AnalisePanel })),
);
const AtividadesPanel = lazy(() =>
  import("@/components/contratos-servico/AtividadesPanel").then((m) => ({ default: m.AtividadesPanel })),
);
const ChatContratoPanel = lazy(() =>
  import("@/components/contratos-servico/ChatContratoPanel").then((m) => ({ default: m.ChatContratoPanel })),
);


function PanelSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-40 rounded-md bg-muted/60 animate-pulse" />
      <div className="h-24 rounded-md bg-muted/40 animate-pulse" />
      <div className="h-24 rounded-md bg-muted/40 animate-pulse" />
    </div>
  );
}

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
  const [editContratoOpen, setEditContratoOpen] = useState(false);
  const [editObrigacoesOpen, setEditObrigacoesOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [countAditivos, setCountAditivos] = useState<number>(0);
  const [aba, setAba] = useState<string>("informacoes");
  const location = useLocation();
  const search = Route.useSearch() as any;

  useEffect(() => {
    const abasValidas = [
      "informacoes", "checklists", "retencoes", "agenda", "reajustes",
      "aditivos", "analise", "responsaveis", "atividades", "ia",
    ];
    const tabAlvo = search.tab;
    const hashAlvo = (location.hash ?? "").replace(/^#/, "");
    
    if (tabAlvo && abasValidas.includes(tabAlvo)) setAba(tabAlvo);
    else if (hashAlvo && abasValidas.includes(hashAlvo)) setAba(hashAlvo);
  }, [location.hash, search.tab]);

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
    if (search.edit === 'true') {
      setEditContratoOpen(true);
    }
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
      <>
        <div className="max-w-4xl">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate({ to: "/app/contratos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </>
    );
  }
  if (!ficha) {
    return (
      <>
        <div className="max-w-4xl space-y-4">
          <AppSkeletonLines lines={2} className="w-72" />
          <AppSkeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  const c = ficha.contrato;
  const status = statusExibicaoContrato(c);
  const temArquivo = !!(c.arquivo_path || c.documento_id);

  return (
    <>
      <div className="max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/app/contratos" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="mr-1 h-4 w-4" /> Contratos
          </Link>
          <ContratosTabs condominioId={c.condominio_id ?? null} />
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <header className="app-page-header">
            <span className="app-eyebrow">
              {c.tipos_servico_contrato?.nome ?? "Contrato de prestação de serviços"}
            </span>
            <h1 className="app-title">{c.prestador_nome}</h1>
            <p className="app-subtitle flex flex-wrap items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              {c.condominios?.nome ?? "Condomínio"}
              <ContratoStatusBadge status={status} />
            </p>
          </header>
          <div className="flex flex-wrap gap-2">
            <AvisosSwitch
              contratoId={contratoId}
              ativo={!!c.notificacoes_ativas}
              onChange={(v) => setFicha((prev) => (prev ? { ...prev, contrato: { ...prev.contrato, notificacoes_ativas: v } } : prev))}
            />
            <Button
              variant="augusto"
              onClick={() => {
                setAba("analise");
                if (!temArquivo) {
                  toast.info("Anexe o arquivo do contrato para gerar a análise.");
                }
              }}
              disabled={!temArquivo}
              title={temArquivo ? "Analisar com Augusto" : "Anexe o arquivo do contrato para gerar a análise"}
            >
              <Sparkles className="mr-1 h-4 w-4" /> Analisar com Augusto
            </Button>
            <EncerrarSuspenderMenu contratoId={contratoId} situacao={c.situacao} onChange={carregar} />
            <Button variant="outline" onClick={() => setEditContratoOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Editar dados
            </Button>
            <Button variant="ghost" onClick={() => setConfirmar(true)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          </div>
        </div>

        <EditContratoModal 
          open={editContratoOpen} 
          onOpenChange={setEditContratoOpen} 
          initialValues={{
            id: c.id,
            condominio_id: c.condominio_id,
            tipo_servico_id: c.tipo_servico_id,
            situacao: c.situacao,
            prestador_nome: c.prestador_nome,
            objeto: c.objeto,
            data_inicio: c.data_inicio,
            prazo_indeterminado: c.prazo_indeterminado,
            data_fim: c.data_fim,
            valor: Number(c.valor),
            tipo_valor: c.tipo_valor,
            dia_vencimento: c.dia_vencimento,
            indice_reajuste: c.indice_reajuste as any,
            mes_base_reajuste: c.mes_base_reajuste,
          }}
          onSaved={carregar}
        />
        <EditObrigacoesModal
          open={editObrigacoesOpen}
          onOpenChange={setEditObrigacoesOpen}
          contratoId={contratoId}
          initialObrigacoes={ficha.obrigacoes}
          onSaved={carregar}
        />

        <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start">
          <aside className="w-full shrink-0 md:sticky md:top-24 md:w-64">
            <nav className="flex flex-col gap-1 rounded-xl border border-border bg-card/50 p-3 shadow-sm backdrop-blur-sm">
              <NavGroup label="Principal">
                <NavItem 
                  active={aba === "informacoes"} 
                  onClick={() => setAba("informacoes")} 
                  icon={<FileText className="h-4 w-4" />} 
                  label="Resumo e Dados" 
                />
                <NavItem 
                  active={aba === "checklists"} 
                  onClick={() => setAba("checklists")} 
                  icon={<ListChecks className="h-4 w-4" />} 
                  label="Checklists (Rotina)" 
                />
                <NavItem 
                  active={aba === "retencoes"} 
                  onClick={() => setAba("retencoes")} 
                  icon={<Shield className="h-4 w-4" />} 
                  label="Retenções e Impostos" 
                />
              </NavGroup>
              
              <Separator className="my-2 opacity-50" />
              
              <NavGroup label="Gestão">
                <NavItem 
                  active={aba === "agenda"} 
                  onClick={() => setAba("agenda")} 
                  icon={<CalendarClock className="h-4 w-4" />} 
                  label="Agenda Financeira" 
                />
                <NavItem 
                  active={aba === "reajustes"} 
                  onClick={() => setAba("reajustes")} 
                  icon={<ArrowUpRightSquare className="h-4 w-4" />} 
                  label="Reajustes" 
                />
                <NavItem 
                  active={aba === "responsaveis"} 
                  onClick={() => setAba("responsaveis")} 
                  icon={<Users className="h-4 w-4" />} 
                  label="Responsáveis" 
                />
              </NavGroup>
              
              <Separator className="my-2 opacity-50" />
              
              <NavGroup label="Histórico e IA">
                <NavItem 
                  active={aba === "analise"} 
                  onClick={() => setAba("analise")} 
                  icon={<Sparkles className="h-4 w-4" />} 
                  label="Análise de IA" 
                />
                <NavItem 
                  active={aba === "aditivos"} 
                  onClick={() => setAba("aditivos")} 
                  icon={<FilePlus2 className="h-4 w-4" />} 
                  label="Aditivos" 
                  badge={countAditivos > 0 ? countAditivos : undefined}
                />
                <NavItem 
                  active={aba === "atividades"} 
                  onClick={() => setAba("atividades")} 
                  icon={<Activity className="h-4 w-4" />} 
                  label="Log de Atividades" 
                />
                <NavItem 
                  active={aba === "ia"} 
                  onClick={() => setAba("ia")} 
                  icon={<MessageSquare className="h-4 w-4" />} 
                  label="Perguntar à IJ" 
                />

              </NavGroup>
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {aba === "informacoes" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-6">
                <Card className="app-card-interactive grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-augusto-gold/20 bg-gradient-to-br from-card to-augusto-gold/[0.04] p-5 transition-all duration-200 hover:border-augusto-gold/40">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--app-radius)] bg-augusto-gold/15 text-augusto-gold ring-1 ring-augusto-gold/20">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Arquivo do contrato</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {c.arquivo_path
                        ? "Enviado na importação"
                        : c.documento_id
                          ? "Vinculado ao acervo do condomínio"
                          : "Nenhum arquivo vinculado. Anexe um PDF, DOCX ou TXT (até 10 MB)."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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

                <div className="flex flex-col gap-4">
                  {/* Prestador */}
                  <ExpandableSection
                    titulo="Prestador"
                    icon={<Briefcase className="h-4 w-4" />}
                    resumo={c.prestador_nome}
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div>
                        <p className="font-serif text-2xl leading-tight text-primary">{c.prestador_nome ?? "—"}</p>
                        {c.prestador_documento && (
                          <p className="mt-1 text-sm text-muted-foreground">CNPJ/CPF · {c.prestador_documento}</p>
                        )}
                      </div>
                      <div className="space-y-3 rounded-lg bg-muted/30 p-4">
                        <ContactLine icon={<Mail className="h-4 w-4" />} href={c.prestador_email ? `mailto:${c.prestador_email}` : null}>
                          {c.prestador_email ?? "Não informado"}
                        </ContactLine>
                        <ContactLine icon={<Phone className="h-4 w-4" />} href={c.prestador_telefone ? `tel:${c.prestador_telefone}` : null}>
                          {c.prestador_telefone ?? "Não informado"}
                        </ContactLine>
                      </div>
                    </div>
                  </ExpandableSection>

                  {/* Objeto */}
                  <ExpandableSection
                    titulo="Objeto do Contrato"
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    resumo={c.tipos_servico_contrato?.nome || "Detalhes do serviço"}
                  >
                    <div className="space-y-4">
                      {c.tipos_servico_contrato?.nome && (
                        <div className="flex flex-wrap gap-2">
                          <StatBadge>{c.tipos_servico_contrato.nome}</StatBadge>
                          {c.terceirizacao_mao_de_obra && (
                            <StatBadge tone="warning" icon={<Check className="h-3 w-3" />}>Mão de obra terceirizada</StatBadge>
                          )}
                        </div>
                      )}
                      <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                        <ExpandableText text={c.objeto || "Objeto não detalhado no cadastro."} limit={300} />
                      </div>
                    </div>
                  </ExpandableSection>

                  {/* Financeiro */}
                  <ExpandableSection
                    titulo="Financeiro"
                    icon={<Wallet className="h-4 w-4" />}
                    resumo={c.valor === null ? "—" : `${formatBRL(Number(c.valor))} ${c.tipo_valor === "mensal" ? "/ mês" : ""}`}
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="flex flex-col justify-center">
                        <p className="text-sm font-medium text-muted-foreground">Valor do Contrato</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <p className="font-serif text-4xl text-primary">
                            {c.valor === null ? "—" : formatBRL(Number(c.valor))}
                          </p>
                          {c.valor !== null && (
                            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                              {c.tipo_valor === "mensal" ? "por mês" : "valor global"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border/50 p-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                            <CalendarDays className="h-3.5 w-3.5 text-augusto-gold" />
                            {c.dia_vencimento ? `Todo dia ${c.dia_vencimento}` : "Não informado"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/50 p-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Recorrência</p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                            <Hash className="h-3.5 w-3.5 text-augusto-gold" />
                            {c.tipo_valor === "mensal" ? "Mensal" : "Único / Global"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </ExpandableSection>

                  {/* Vigência */}
                  <ExpandableSection
                    titulo="Vigência e Prazo"
                    icon={<CalendarRange className="h-4 w-4" />}
                    resumo={`${formatDate(c.data_inicio)} até ${c.prazo_indeterminado ? "Indeterminado" : formatDate(c.data_fim)}`}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 rounded-xl bg-muted/30 p-4 text-center">
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Início da Vigência</p>
                          <p className="mt-2 font-serif text-2xl text-foreground">{formatDate(c.data_inicio)}</p>
                        </div>
                        <div className="hidden h-px flex-1 bg-border sm:block" />
                        <div className="flex-1 rounded-xl bg-muted/30 p-4 text-center">
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">Término Previsto</p>
                          <p className="mt-2 font-serif text-2xl text-foreground">
                            {c.prazo_indeterminado ? "Prazo Indeterminado" : formatDate(c.data_fim)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <StatBadge
                          tone={c.renovacao_automatica ? "positive" : "muted"}
                          icon={c.renovacao_automatica ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        >
                          Renovação Automática
                        </StatBadge>
                        {c.renovacao_automatica && c.aviso_previo_dias && (
                          <StatBadge icon={<CalendarClock className="h-3.5 w-3.5" />}>
                            Aviso Prévio: {c.aviso_previo_dias} dias
                          </StatBadge>
                        )}
                      </div>
                    </div>
                  </ExpandableSection>

                  {/* Cláusulas e Garantias - Layout Grid Moderno */}
                  <ExpandableSection
                    titulo="Cláusulas e Garantias"
                    icon={<Scale className="h-4 w-4" />}
                    resumo="Multas, seguros e foro eleito"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <ClauseCard icon={<Percent className="h-4 w-4" />} label="Multa Rescisória" value={c.multa_rescisoria} />
                      <ClauseCard
                        icon={<Shield className="h-4 w-4" />}
                        label="Seguro RC"
                        value={c.exige_seguro_rc ? "Exigido pelo Contrato" : "Não Exigido"}
                        tone={c.exige_seguro_rc ? "positive" : "default"}
                      />
                      <ClauseCard icon={<Landmark className="h-4 w-4" />} label="Foro Eleito" value={c.foro} />
                      <div className="sm:col-span-2 lg:col-span-3 mt-2 rounded-xl border border-border/50 bg-card p-5">
                        <div className="mb-3 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
                          <ScrollText className="h-4 w-4 text-augusto-gold" />
                          Garantias Contratuais
                        </div>
                        <ExpandableText text={c.garantias || "Nenhuma garantia específica informada."} limit={200} />
                      </div>
                    </div>
                  </ExpandableSection>

                  {/* Obrigações */}
                  <ExpandableSection
                    titulo="Obrigações do Contrato"
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    resumo={`${ficha.obrigacoes.length} obrigações listadas`}
                  >
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                          <StatBadge tone="muted">
                            {ficha.obrigacoes.filter((o) => o.parte === "condominio").length} do Condomínio
                          </StatBadge>
                          <StatBadge tone="muted">
                            {ficha.obrigacoes.filter((o) => o.parte === "prestador").length} do Prestador
                          </StatBadge>
                        </div>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditObrigacoesOpen(true); }} className="w-full sm:w-auto">
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar Obrigações
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" /> Condomínio
                          </p>
                          <div className="space-y-2">
                            {ficha.obrigacoes.filter(o => o.parte === 'condominio').length > 0 ? (
                              ficha.obrigacoes.filter(o => o.parte === 'condominio').map((o, idx) => (
                                <div key={idx} className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm text-foreground text-justify hyphens-auto">
                                  {o.descricao}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs italic text-muted-foreground">Nenhuma obrigação registrada.</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Briefcase className="h-3.5 w-3.5" /> Prestador
                          </p>
                          <div className="space-y-2">
                            {ficha.obrigacoes.filter(o => o.parte === 'prestador').length > 0 ? (
                              ficha.obrigacoes.filter(o => o.parte === 'prestador').map((o, idx) => (
                                <div key={idx} className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm text-foreground text-justify hyphens-auto">
                                  {o.descricao}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs italic text-muted-foreground">Nenhuma obrigação registrada.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ExpandableSection>
                </div>
              </div>
            )}

            {aba === "checklists" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <ChecklistsPanel contratoId={contratoId} />
                </Suspense>
              </div>
            )}
            
            {aba === "retencoes" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <RetencoesCard contratoId={contratoId} />
                </Suspense>
              </div>
            )}
            
            {aba === "agenda" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <AgendaPanel contratoId={contratoId} />
                </Suspense>
              </div>
            )}
            
            {aba === "reajustes" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
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
                </Suspense>
              </div>
            )}
            
            {aba === "responsaveis" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <ResponsaveisPanel contratoId={contratoId} />
                </Suspense>
              </div>
            )}
            
            {aba === "aditivos" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <AditivosPanel contratoId={contratoId} onCountChange={setCountAditivos} />
                </Suspense>
              </div>
            )}
            
            {aba === "analise" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <AnalisePanel
                    contratoId={contratoId}
                    temArquivo={temArquivo}
                    condominioId={c.condominio_id}
                    prestadorNome={c.prestador_nome}
                    objeto={c.objeto ?? null}
                  />
                </Suspense>
              </div>
            )}
            
            {aba === "atividades" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Suspense fallback={<PanelSkeleton />}>
                  <AtividadesPanel contratoId={contratoId} />
                </Suspense>
              </div>
            )}
            {aba === "ia" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-[500px]">
                <Suspense fallback={<PanelSkeleton />}>
                   <ChatContratoPanel 
                     contratoId={contratoId}
                     condominioId={c.condominio_id}
                     prestadorNome={c.prestador_nome}
                   />
                </Suspense>
              </div>
            )}

          </main>
        </div>
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
    </>
  );
}


function ExpandableSection({
  titulo,
  icon,
  resumo,
  children,
}: {
  titulo: string;
  icon: React.ReactNode;
  resumo?: string | null;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden border-border/40 transition-all hover:border-augusto-gold/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-augusto-gold/10 text-augusto-gold">
              {icon}
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {titulo}
              </h3>
              {resumo && !isOpen && (
                <p className="mt-0.5 truncate text-sm font-medium text-foreground transition-all animate-in fade-in slide-in-from-left-1">
                  {resumo}
                </p>
              )}
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:bg-augusto-gold/10 hover:text-augusto-gold">
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              <span className="sr-only">Expandir seção {titulo}</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t border-border/40 bg-muted/5 p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ClauseCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive";
}) {
  const empty = value === null || value === undefined || value === "";
  const toneClasses = {
    default: "bg-card border-border/50",
    positive: "bg-augusto-green/5 border-augusto-green/20",
  };

  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">
        <span className="text-augusto-gold">{icon}</span>
        {label}
      </div>
      <p className={`text-sm font-semibold ${empty ? "text-muted-foreground italic" : tone === 'positive' ? 'text-augusto-green' : 'text-foreground'}`}>
        {empty ? "Não informado" : value}
      </p>
    </div>
  );
}

function StatBadge({
  children,
  icon,
  tone = "default",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "muted" | "positive" | "warning";
}) {
  const tones: Record<string, string> = {
    default: "bg-augusto-gold/10 text-augusto-gold ring-augusto-gold/25",
    muted: "bg-muted text-muted-foreground ring-border",
    positive: "bg-augusto-green/10 text-augusto-green ring-augusto-green/25",
    warning: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-200 ${tones[tone]}`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

function ContactLine({
  icon,
  href,
  children,
}: {
  icon: React.ReactNode;
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <span>{icon}</span>
        <span className="truncate">{children}</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      className="flex min-w-0 items-center gap-2 rounded-md text-sm text-foreground transition-colors duration-200 hover:text-augusto-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/40"
    >
      <span className="text-muted-foreground transition-colors duration-200 group-hover:text-augusto-gold/80">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </a>
  );
}

function ClauseRow({
  icon,
  label,
  value,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  positive?: boolean;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-augusto-gold/80">{icon}</span>
        {label}
      </span>
      <span
        className={`text-right text-sm font-medium ${
          empty
            ? "text-muted-foreground"
            : positive === true
              ? "text-augusto-green"
              : "text-foreground"
        }`}
      >
        {empty ? "—" : value}
      </span>
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

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="mb-2 px-3 text-[0.625rem] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
        {label}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-augusto-gold/10 text-primary shadow-sm ring-1 ring-augusto-gold/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`transition-colors duration-200 ${
            active ? "text-augusto-gold" : "text-muted-foreground/60 group-hover:text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {badge ? (
        <span
          className={`grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-[0.625rem] font-bold ring-1 ${
            active
              ? "bg-augusto-gold text-white ring-augusto-gold"
              : "bg-muted text-muted-foreground ring-border"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
