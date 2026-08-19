import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  FileText, Plus, Sparkles, Filter, ChevronDown, Search, 
  ArrowUpDown, MoreHorizontal, X 
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContratosTabs } from "@/components/contratos-servico/ContratosTabs";
import { GestaoContratosGate } from "@/components/gates/GestaoContratosGate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContratoStatusBadge } from "@/components/contratos-servico/ContratoStatusBadge";
import { QuickViewDrawer } from "@/components/contratos-servico/QuickViewDrawer";
import { Badge } from "@/components/ui/badge";
import { AppSkeleton } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import {
  listCondominiosParaContratos,
  listContratosServico,
  listTiposServicoContrato,
  type ContratoLinha,
} from "@/lib/contratos-servico/contratos.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { listContratoIdsComPendencia } from "@/lib/contratos-servico/quickview.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/contratos/")({
  component: Page,
});

const TODOS = "__todos";

type Visao = "todos" | "vencendo" | "vencidos" | "suspensos" | "encerrados" | "checklist" | "sem-responsavel" | "sem-mes-base" | "sem-documento" | "sem-indice";

const VISOES_PENDENCIA = ["checklist", "sem-responsavel", "sem-mes-base", "sem-documento", "sem-indice"] as const;
type VisaoPendencia = (typeof VISOES_PENDENCIA)[number];

function isVisaoPendencia(v: Visao): v is VisaoPendencia {
  return (VISOES_PENDENCIA as readonly string[]).includes(v);
}

function Page() {
  const navigate = useNavigate();
  const listFn = useServerFn(listContratosServico);
  const condosFn = useServerFn(listCondominiosParaContratos);
  const tiposFn = useServerFn(listTiposServicoContrato);
  const pendenciaIdsFn = useServerFn(listContratoIdsComPendencia);
  const checkAdmin = useServerFn(isCurrentUserAdmin);

  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<ContratoLinha[] | null>(null);
  const [counters, setCounters] = useState({ vigentes: 0, vencendo: 0, vencidos: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const [condos, setCondos] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);

  const [condominioId, setCondominioId] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>(TODOS);
  const [tipoId, setTipoId] = useState<string>(TODOS);
  const [busca, setBusca] = useState("");
  const [visao, setVisao] = useState<Visao>("todos");
  const [selectedContrato, setSelectedContrato] = useState<ContratoLinha | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const search = Route.useSearch() as any;

  useEffect(() => {
    if (search.view) {
      setVisao(search.view as Visao);
    }
    if (search.cid) {
      setCondominioId(search.cid);
    }
  }, [search.view, search.cid]);

  useEffect(() => {
    Promise.all([condosFn(), tiposFn(), checkAdmin()])
      .then(([c, t, adm]) => {
        setCondos(c.rows as Array<{ id: string; nome: string }>);
        setTipos(t.rows as Array<{ id: string; nome: string }>);
        setIsAdmin(!!adm?.admin);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [condosFn, tiposFn, checkAdmin]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setErro(null);
      
      let statusFiltro = status === TODOS ? null : status;
      if (visao === "vencendo") statusFiltro = "vence_em_breve";
      else if (visao === "vencidos") statusFiltro = "vencido";
      else if (visao === "suspensos") statusFiltro = "suspenso";
      else if (visao === "encerrados") statusFiltro = "encerrado";
      else if (isVisaoPendencia(visao)) {
        statusFiltro = "vigente";
      }

      const cid = condominioId === TODOS ? null : condominioId;

      Promise.all([
        listFn({
          data: {
            condominioId: cid,
            statusExibicao: statusFiltro as any,
            tipoServicoId: tipoId === TODOS ? null : tipoId,
            busca: busca.trim() === "" ? null : busca.trim(),
          },
        }),
        isVisaoPendencia(visao)
          ? pendenciaIdsFn({ data: { tipo: visao, condominioId: cid } })
          : Promise.resolve(null),
      ])
        .then(([r, pend]) => {
          const ids = pend ? new Set(pend.ids) : null;
          setRows(ids ? r.rows.filter((x) => ids.has(x.id)) : r.rows);
          setCounters(r.counters);
        })
        .catch((e: Error) => {
          setErro(e.message);
          toast.error(e.message);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [listFn, pendenciaIdsFn, condominioId, status, tipoId, busca, visao]);

  const total = useMemo(() => rows?.length ?? 0, [rows]);

  const visaoLabel = {
    todos: "Todos os contratos",
    vencendo: "Vencendo em breve",
    vencidos: "Vencidos",
    suspensos: "Suspensos",
    encerrados: "Encerrados",
    checklist: "Checklists pendentes",
    "sem-responsavel": "Sem responsável",
    "sem-mes-base": "Sem mês-base",
    "sem-documento": "Sem documento",
    "sem-indice": "Sem índice",
  }[visao];


  return (
    <>
      <GestaoContratosGate>
      <div className="max-w-6xl space-y-6 animate-augusto-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <header className="app-page-header">
            <span className="app-eyebrow">Gestão de Contratos</span>
            <div className="flex items-center gap-3">
              <h1 className="app-title">Contratos</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 border-augusto-gold/20 bg-augusto-gold/5 text-augusto-gold">
                    {visaoLabel} <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Visões rápidas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setVisao("todos"); setStatus(TODOS); }}>Todos os contratos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisao("vencendo")}>Vencendo em 90 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisao("vencidos")}>Vencidos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setVisao("suspensos")}>Suspensos</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisao("encerrados")}>Encerrados</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="flex items-center gap-2">
            <ContratosTabs condominioId={condominioId === TODOS ? null : condominioId} />
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/app/contratos/importar" })}>
              <Sparkles className="h-4 w-4 mr-1" /> Importar com IA
            </Button>
            <Button size="sm" variant="augusto" onClick={() => navigate({ to: "/app/contratos/novo" })}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Counter label="Vigentes" value={counters.vigentes} tone="emerald" onClick={() => { setVisao("todos"); setStatus("vigente"); }} />
          <Counter label="Vencendo em breve" value={counters.vencendo} tone="amber" onClick={() => setVisao("vencendo")} />
          <Counter label="Vencidos" value={counters.vencidos} tone="red" onClick={() => setVisao("vencidos")} />
        </div>

        <Card className="app-card border-augusto-gold/10">
          <div className="p-4 border-b border-border/40 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por prestador…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-9 bg-muted/20 border-border/40 focus:border-augusto-gold/40"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select 
                value={condominioId} 
                onValueChange={(v) => {
                  setCondominioId(v);
                  // O useEffect já reage a condominioId
                }}
              >
                <SelectTrigger className="h-9 w-[180px] bg-muted/20 border-border/40 focus:ring-augusto-green">
                  <SelectValue placeholder="Condomínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os condomínios</SelectItem>
                  {condos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={tipoId} 
                onValueChange={(v) => {
                  setTipoId(v);
                }}
              >
                <SelectTrigger className="h-9 w-[180px] bg-muted/20 border-border/40 focus:ring-augusto-green">
                  <SelectValue placeholder="Tipo de serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 text-muted-foreground hover:text-primary transition-colors" 
                onClick={() => { 
                  setBusca(""); 
                  setCondominioId(TODOS); 
                  setTipoId(TODOS); 
                  setStatus(TODOS); 
                  setVisao("todos"); 
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          {/* Chips de Filtros Ativos */}
          {(condominioId !== TODOS || tipoId !== TODOS || busca || status !== TODOS) && (
            <div className="px-4 py-2 border-b border-border/40 bg-muted/10 flex flex-wrap gap-2">
              {condominioId !== TODOS && (
                <Badge variant="secondary" className="bg-augusto-gold/10 text-augusto-gold hover:bg-augusto-gold/20 gap-1 border-augusto-gold/20">
                  Condomínio: {condos.find(c => c.id === condominioId)?.nome}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCondominioId(TODOS)} />
                </Badge>
              )}
              {tipoId !== TODOS && (
                <Badge variant="secondary" className="bg-augusto-gold/10 text-augusto-gold hover:bg-augusto-gold/20 gap-1 border-augusto-gold/20">
                  Tipo: {tipos.find(t => t.id === tipoId)?.nome}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setTipoId(TODOS)} />
                </Badge>
              )}
              {busca && (
                <Badge variant="secondary" className="bg-augusto-gold/10 text-augusto-gold hover:bg-augusto-gold/20 gap-1 border-augusto-gold/20">
                  Busca: {busca}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setBusca("")} />
                </Badge>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            {erro ? (
              <div className="p-8 text-center text-destructive">{erro}</div>
            ) : rows === null ? (
              <div className="p-8 space-y-4">
                <AppSkeleton className="h-10 w-full" />
                <AppSkeleton className="h-10 w-full" />
                <AppSkeleton className="h-10 w-full" />
              </div>
            ) : total === 0 ? (
              <div className="p-12">
                <AppEmptyState
                  icon={<FileText className="opacity-20" size={48} />}
                  title="Nenhum contrato encontrado"
                  description="Ajuste os filtros ou cadastre um novo contrato."
                  action={
                    <Button variant="outline" size="sm" onClick={() => { setBusca(""); setVisao("todos"); }}>
                      Ver todos os contratos
                    </Button>
                  }
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/40">
                    <Th className="w-[40%]">Prestador & Tipo</Th>
                    <Th>Condomínio</Th>
                    <Th>Próximo Vencimento</Th>
                    <Th>Valor</Th>
                    <Th className="text-right">Saúde</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r) => (
                    <tr 
                      key={r.id} 
                      className="group hover:bg-augusto-gold/[0.02] cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedContrato(r);
                        setDrawerOpen(true);
                      }}
                    >
                      <Td>
                        <div>
                          <p className="font-semibold text-primary group-hover:text-augusto-gold transition-colors">{r.prestador_nome}</p>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{r.tipo_servico_nome ?? "Serviço não especificado"}</p>
                        </div>
                      </Td>
                      <Td className="text-muted-foreground">{r.condominio_nome}</Td>
                      <Td className="text-muted-foreground">
                        {r.prazo_indeterminado ? (
                          <span className="text-xs text-augusto-green bg-augusto-green/5 px-2 py-0.5 rounded-full border border-augusto-green/10">Indeterminado</span>
                        ) : (
                          formatDate(r.data_fim)
                        )}
                      </Td>
                      <Td>
                        <p className="font-medium text-foreground">{r.valor ? formatBRL(Number(r.valor)) : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{r.tipo_valor === "mensal" ? "Mensal" : "Valor Único"}</p>
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <ContratoStatusBadge status={r.status} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {total > 0 && (
            <div className="p-3 border-t border-border/40 text-[11px] text-muted-foreground text-center">
              Mostrando {total} {total === 1 ? "contrato" : "contratos"}
            </div>
          )}
        </Card>
      </div>
      </GestaoContratosGate>
      <QuickViewDrawer 
        contrato={selectedContrato}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}

function Counter({ label, value, tone, onClick }: { label: string; value: number; tone: "emerald" | "amber" | "red"; onClick: () => void }) {
  const tones = {
    emerald: "border-l-augusto-green text-augusto-green bg-augusto-green/[0.02]",
    amber: "border-l-augusto-gold text-augusto-gold bg-augusto-gold/[0.02]",
    red: "border-l-destructive text-destructive bg-destructive/[0.02]",
  };
  return (
    <Card 
      className={cn("app-card p-4 border-l-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]", tones[tone])}
      onClick={onClick}
    >
      <p className="text-[10px] uppercase tracking-widest font-bold opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-serif">{value}</p>
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
