import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listCondominios, createCondominio } from "@/lib/condominios.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/condominios/")({
  component: CondominiosPage,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  cnpj: z.string().trim().max(20).optional(),
  uf: z.string().trim().length(2, "UF deve ter 2 letras").optional().or(z.literal("")),
  qtd_unidades: z.coerce.number().int().min(0).max(100000).optional(),
});

function CondominiosPage() {
  const fetchList = useServerFn(listCondominios);
  const create = useServerFn(createCondominio);
  const [items, setItems] = useState<Array<{ id: string; nome: string; uf: string | null; qtd_unidades: number | null; cnpj: string | null }>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", uf: "", qtd_unidades: "" });
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
      await create({ data: {
        nome: parsed.data.nome,
        cnpj: parsed.data.cnpj || null,
        uf: parsed.data.uf ? parsed.data.uf.toUpperCase() : null,
        qtd_unidades: parsed.data.qtd_unidades ?? null,
      }});
      toast.success("Condomínio criado!");
      setOpen(false);
      setForm({ nome: "", cnpj: "", uf: "", qtd_unidades: "" });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Meus condomínios</h1>
            <p className="text-muted-foreground">Gerencie os condomínios sob sua administração.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo condomínio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar condomínio</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="nome">Nome *</Label><Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="uf">UF</Label><Input id="uf" value={form.uf} maxLength={2} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="SP" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="qtd">Unidades</Label><Input id="qtd" type="number" min={0} value={form.qtd_unidades} onChange={(e) => setForm({ ...form, qtd_unidades: e.target.value })} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Cadastrar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          {items.length === 0 ? (
            <Card className="p-8 text-center border-dashed col-span-full">
              <Building className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum condomínio cadastrado ainda.</p>
            </Card>
          ) : items.map((c) => (
            <Link key={c.id} to="/app/condominios/$id" params={{ id: c.id }}>
              <Card className="p-4 hover:border-accent transition-colors">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-accent/10 p-2"><Building className="h-5 w-5 text-accent" /></div>
                  <div className="min-w-0">
                    <p className="font-medium text-primary truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.uf ?? "—"} • {c.qtd_unidades ?? 0} unidades {c.cnpj ? `• ${c.cnpj}` : ""}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}