import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building, Plus, Scale, Gavel, FileText, Calculator, MessagesSquare, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listCondominios, getProfile, getUsoMensal } from "@/lib/condominios.functions";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

const skills = [
  { icon: Scale, label: "Jurídico" },
  { icon: Gavel, label: "Assembleias" },
  { icon: FileText, label: "Documentos" },
  { icon: Calculator, label: "Finanças" },
  { icon: MessagesSquare, label: "Comunicação" },
  { icon: ShieldCheck, label: "LGPD" },
];

function DashboardPage() {
  const fetchCondos = useServerFn(listCondominios);
  const fetchProfile = useServerFn(getProfile);
  const fetchUso = useServerFn(getUsoMensal);
  const [condos, setCondos] = useState<Array<{ id: string; nome: string; uf: string | null; qtd_unidades: number | null }>>([]);
  const [nome, setNome] = useState<string>("");
  const [uso, setUso] = useState({ total_mensagens: 0 });

  useEffect(() => {
    fetchCondos().then((r) => setCondos(r as typeof condos)).catch(() => {});
    fetchProfile().then((p) => setNome((p?.nome || p?.email || "").split(" ")[0])).catch(() => {});
    fetchUso().then((u) => setUso(u as typeof uso)).catch(() => {});
  }, [fetchCondos, fetchProfile, fetchUso]);

  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold text-primary">Olá{nome ? `, ${nome}` : ""} 👋</h1>
        <p className="text-muted-foreground">Bem-vindo ao seu painel do CondoIA.</p>

        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Condomínios cadastrados</p>
            <p className="mt-2 text-3xl font-bold text-primary">{condos.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Mensagens este mês</p>
            <p className="mt-2 text-3xl font-bold text-primary">{uso.total_mensagens}</p>
            <p className="text-xs text-muted-foreground mt-1">Plano: trial (7 dias)</p>
          </Card>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary">Seus condomínios</h2>
            <Link to="/app/condominios"><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Novo</Button></Link>
          </div>
          {condos.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Building className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">Você ainda não cadastrou nenhum condomínio.</p>
              <Link to="/app/condominios" className="inline-block mt-4"><Button>Cadastrar primeiro condomínio</Button></Link>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {condos.map((c) => (
                <Link key={c.id} to="/app/condominios/$id" params={{ id: c.id }}>
                  <Card className="p-4 hover:border-accent transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-accent/10 p-2"><Building className="h-5 w-5 text-accent" /></div>
                      <div>
                        <p className="font-medium text-primary">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.uf ?? "—"} • {c.qtd_unidades ?? 0} unidades</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-primary mb-3">Habilidades do assistente</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {skills.map((s) => (
              <Card key={s.label} className="p-4 text-center opacity-60">
                <s.icon className="h-6 w-6 text-accent mx-auto" />
                <p className="mt-2 text-xs font-medium">{s.label}</p>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">O chat com IA será habilitado em breve. Cadastre um condomínio e envie documentos para começar.</p>
        </section>
      </div>
    </AppShell>
  );
}