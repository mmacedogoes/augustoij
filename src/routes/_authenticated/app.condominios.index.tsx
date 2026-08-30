import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building, Plus, Lock, Sparkles } from "lucide-react";
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

function CondominiosPage() {
  const fetchList = useServerFn(listCondominios);
  const create = useServerFn(createCondominio);
  const { data: plano, refetch: refetchPlano } = usePlanContext();
  const [items, setItems] = useState<Array<{ id: string; nome: string; uf: string | null; cidade: string | null; qtd_unidades: number | null; cnpj: string | null }>>([]);
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
                <Button variant="augusto"><Plus className="h-4 w-4" /> Novo condomínio</Button>
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
                <div className="space-y-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Tipo de condomínio *</Label>
                  <select
                    id="categoria"
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
                  <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="uf">UF</Label><Input id="uf" value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="SP" /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Ex.: João Pessoa"
                    required
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  O número de unidades será extraído automaticamente da convenção do condomínio.
                </p>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
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

        <div className="mt-2 grid sm:grid-cols-2 gap-4 app-stagger">
          {items.length === 0 ? (
            <Card className="app-card p-10 border-dashed border-[var(--landing-rule)] col-span-full bg-gradient-to-b from-card to-muted/30">
              <AppEmptyState
                icon={<Building strokeWidth={1.5} />}
                title="Nenhum condomínio cadastrado ainda"
              />
            </Card>
          ) : items.map((c) => (
            <Link
              key={c.id}
              to="/app/condominios/$id"
              params={{ id: c.id }}
              className="group focus-visible:outline-none"
            >
              <Card className="app-card-interactive p-5 group-focus-visible:ring-2 group-focus-visible:ring-augusto-gold/70">
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
          ))}
        </div>
      </div>
    </>
  );
}