import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { Building, Plus, Lock, Sparkles, Search, X, ArrowDownAZ, MapPin, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listCondominios, createCondominio } from "@/lib/condominios.functions";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { usePlanContext } from "@/hooks/usePlanContext";
import { gateMessages } from "@/lib/plan-gates";
import { toast } from "sonner";
import {
  CATEGORIAS_CONDOMINIO,
  type CategoriaCondominio,
  getCategoriaMeta,
} from "@/lib/categorias-condominio";

export const Route = createFileRoute("/_authenticated/app/condominios/")({
  component: CondominiosPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  cnpj: z.string().trim().max(20).optional(),
  uf: z.string().trim().length(2, "UF deve ter 2 letras").optional().or(z.literal("")),
  cidade: z.string().trim().min(2, "Informe a cidade").max(120),
  categoria: z.enum(["predio", "casas", "salas_comerciais", "shopping", "galpoes"]),
});

function normalizarTexto(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function CondominiosPage() {
  const fetchList = useServerFn(listCondominios);
  const create = useServerFn(createCondominio);
  const { data: plano, refetch: refetchPlano } = usePlanContext();
  const [items, setItems] = useState<Array<{ id: string; nome: string; uf: string | null; cidade: string | null; qtd_unidades: number | null; cnpj: string | null }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [form, setForm] = useState<{
    nome: string;
    cnpj: string;
    uf: string;
    cidade: string;
    categoria: CategoriaCondominio;
  }>({ nome: "", cnpj: "", uf: "", cidade: "", categoria: "predio" });
  const [loading, setLoading] = useState(false);

  async function reload() {
    const r = await fetchList();
    setItems(r as typeof items);
  }
  useEffect(() => { reload().catch(() => {}); }, []);

  // Fechar dropdown de autocomplete ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsAutocompleteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ordenação Alfabética A-Z estrita com locale pt-BR
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
  }, [items]);

  // Filtragem dinâmica por termo de busca
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return sortedItems;
    const term = normalizarTexto(searchTerm);
    const digitosTerm = searchTerm.replace(/\D/g, "");

    return sortedItems.filter((c) => {
      const matchNome = normalizarTexto(c.nome).includes(term);
      const matchCidade = c.cidade ? normalizarTexto(c.cidade).includes(term) : false;
      const matchUf = c.uf ? normalizarTexto(c.uf).includes(term) : false;
      const matchCnpj = c.cnpj
        ? c.cnpj.includes(term) || (digitosTerm.length > 0 && c.cnpj.replace(/\D/g, "").includes(digitosTerm))
        : false;

      return matchNome || matchCidade || matchUf || matchCnpj;
    });
  }, [sortedItems, searchTerm]);

  // Sugestões para preenchimento automático
  const autocompleteSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return filteredItems.slice(0, 6);
  }, [filteredItems, searchTerm]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const res = await create({ data: {
        nome: parsed.data.nome,
        cnpj: parsed.data.cnpj || null,
        uf: parsed.data.uf ? parsed.data.uf.toUpperCase() : null,
        cidade: parsed.data.cidade,
        qtd_unidades: null,
        categoria: parsed.data.categoria,
      }});
      toast.success("Condomínio criado!");
      setOpen(false);
      setForm({ nome: "", cnpj: "", uf: "", cidade: "", categoria: "predio" });
      reload();
      refetchPlano();
      if ((res as { cidadeNova?: boolean } | null)?.cidadeNova) {
        setShowDisclaimer(true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  }

  const max = plano?.condominiosMax ?? null;
  const noLimite =
    !!plano && max !== null && (plano.condominiosCount ?? items.length) >= max;
  const bloqueadoTrial = !!plano?.trialExpirado;
  const podeCriar = !!plano && !noLimite && !bloqueadoTrial;

  return (
    <>
      <div className="max-w-5xl">
        <div className="flex flex-col gap-4 pb-5 mb-6 border-b border-[var(--landing-rule)] sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="app-eyebrow">Portfólio</span>
            <h1 className="app-title mt-2">Meus condomínios</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Gerencie os condomínios sob sua administração.</p>
            {plano && max !== null && (
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                {items.length} de {max} disponíveis no plano <span className="font-medium text-foreground">{plano.planoNome}</span>
              </p>
            )}
          </div>
          <Dialog open={open} onOpenChange={(v) => podeCriar && setOpen(v)}>
            {podeCriar ? (
              <DialogTrigger asChild>
                <Button variant="augusto" data-testid="btn-novo-condominio"><Plus className="h-4 w-4" /> Novo condomínio</Button>
              </DialogTrigger>
            ) : (
              <Button
                asChild
                variant="secondary"
                className="gap-1.5 transition-all duration-200"
                title={noLimite && plano ? gateMessages.condominiosMax(plano.planoNome, max!) : undefined}
              >
                <Link to="/app/conta">
                  <Lock className="h-4 w-4" /> Fazer upgrade
                </Link>
              </Button>
            )}
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar condomínio</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" data-testid="input-condo-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Tipo de condomínio *</Label>
                  <select
                    id="categoria"
                    data-testid="select-condo-categoria"
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({ ...form, categoria: e.target.value as CategoriaCondominio })
                    }
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {CATEGORIAS_CONDOMINIO.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {getCategoriaMeta(form.categoria).descricaoCurta} — guia a IA na leitura da convenção.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" data-testid="input-condo-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="uf">UF</Label><Input id="uf" data-testid="input-condo-uf" value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="SP" /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    data-testid="input-condo-cidade"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Ex.: João Pessoa"
                    required
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  O número de unidades será extraído automaticamente da convenção do condomínio.
                </p>
                <Button type="submit" data-testid="btn-salvar-condominio" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <AlertDialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bem-vindo!</AlertDialogTitle>
              <AlertDialogDescription>
                Verifiquei que a cidade do seu condomínio é nova em meu banco de dados. Por isso, em
                até 3 dias, terei a atualização de toda a legislação condominial local. Meu banco
                de jurisprudência e legislações federais e estaduais já está a sua disposição.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Entendi</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {noLimite && plano && max !== null && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="grid place-items-center h-8 w-8 shrink-0 rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <p className="text-sm leading-relaxed text-foreground">
                {gateMessages.condominiosMax(plano.planoNome, max)}
              </p>
            </div>
            <Button asChild size="sm" className="self-start sm:self-auto">
              <Link to="/app/conta">Ver planos</Link>
            </Button>
          </div>
        )}

        {/* Barra de Pesquisa com Autocomplete e Ordenação A-Z */}
        {items.length > 0 && (
          <div className="mt-4 mb-5" ref={searchContainerRef}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    data-testid="input-busca-condominio"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsAutocompleteOpen(true);
                    }}
                    onFocus={() => setIsAutocompleteOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsAutocompleteOpen(false);
                      }
                    }}
                    placeholder="Buscar por condomínio, cidade, UF ou CNPJ..."
                    className="pl-10 pr-10 h-10 bg-card border-border/80 text-sm shadow-sm transition-all focus:border-augusto-gold focus:ring-augusto-gold/30"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setIsAutocompleteOpen(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                      title="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown de Preenchimento Automático / Sugestões Rápidas */}
                {isAutocompleteOpen && autocompleteSuggestions.length > 0 && searchTerm.trim().length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-popover/95 backdrop-blur-md border border-border/80 rounded-lg shadow-xl overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 bg-muted/50 border-b border-border/40 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Sugestões de preenchimento</span>
                      <span>{filteredItems.length} encontrado(s)</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
                      {autocompleteSuggestions.map((c) => (
                        <div
                          key={`sugg-${c.id}`}
                          className="px-3.5 py-2.5 hover:bg-augusto-gold/10 cursor-pointer flex items-center justify-between group transition-colors"
                          onClick={() => {
                            setSearchTerm(c.nome);
                            setIsAutocompleteOpen(false);
                          }}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-sm font-medium text-foreground group-hover:text-augusto-green truncate">
                              {c.nome}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              {c.cidade && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3 inline text-muted-foreground/70" />
                                  {c.cidade}{c.uf ? `/${c.uf}` : ""}
                                </span>
                              )}
                              {c.cnpj && <span>• {c.cnpj}</span>}
                            </p>
                          </div>
                          <Link
                            to="/app/condominios/$id"
                            params={{ id: c.id }}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1.5 rounded-md hover:bg-augusto-gold/20 text-muted-foreground group-hover:text-augusto-green transition-colors"
                            title="Acessar condomínio diretamente"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Indicador de Ordem Alfabética e Contagem */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 self-end sm:self-center px-1">
                <span className="flex items-center gap-1.5 font-medium bg-muted/60 px-2.5 py-1.5 rounded-md border border-border/50">
                  <ArrowDownAZ className="h-3.5 w-3.5 text-augusto-gold" />
                  {searchTerm.trim()
                    ? `${filteredItems.length} de ${items.length} condomínios`
                    : `${items.length} condomínios (A-Z)`}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 grid sm:grid-cols-2 gap-4 app-stagger">
          {items.length === 0 ? (
            <Card className="app-card p-10 border-dashed border-[var(--landing-rule)] col-span-full bg-gradient-to-b from-card to-muted/30">
              <AppEmptyState
                icon={<Building strokeWidth={1.5} />}
                title="Nenhum condomínio cadastrado ainda"
              />
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card className="app-card p-8 border-dashed border-[var(--landing-rule)] col-span-full bg-gradient-to-b from-card to-muted/20 text-center">
              <div className="flex flex-col items-center justify-center gap-3">
                <span className="grid place-items-center h-10 w-10 rounded-full bg-muted text-muted-foreground">
                  <Search className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-medium text-foreground">Nenhum condomínio encontrado</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Não encontramos condomínios correspondentes a "{searchTerm}".
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="mt-2 gap-1.5"
                >
                  <X className="h-3.5 w-3.5" /> Limpar busca
                </Button>
              </div>
            </Card>
          ) : (
            filteredItems.map((c) => (
              <Link
                key={c.id}
                to="/app/condominios/$id"
                params={{ id: c.id }}
                className="group focus-visible:outline-none"
              >
                <Card data-testid="condominio-card" className="app-card-interactive p-5 group-focus-visible:ring-2 group-focus-visible:ring-augusto-gold/70">
                  <div className="flex items-center gap-3.5">
                    <span className="app-icon-frame group-hover:bg-augusto-gold/20 group-hover:border-augusto-gold/50">
                      <Building className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-augusto-green truncate leading-tight">{c.nome}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : c.uf ?? "—"} • {c.qtd_unidades != null ? `${c.qtd_unidades} unidades` : "unidades via convenção"} {c.cnpj ? `• ${c.cnpj}` : ""}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}