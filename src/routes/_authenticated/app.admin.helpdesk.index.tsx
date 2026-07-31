import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LifeBuoy, AlertCircle, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { adminListTickets, ASSUNTOS } from "@/lib/helpdesk.functions";

export const Route = createFileRoute("/_authenticated/app/admin/helpdesk/")({
  component: AdminHelpdeskListPage,
});

const STATUS_OPTS = [
  { value: "todos", label: "Todos" },
  { value: "aberto", label: "Aberto" },
  { value: "respondido_cliente", label: "Aguardando suporte" },
  { value: "respondido_admin", label: "Respondido" },
  { value: "encerrado", label: "Encerrado" },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-augusto-gold/20 text-augusto-green border-augusto-gold/40" },
  respondido_admin: { label: "Respondido", className: "bg-augusto-green/15 text-augusto-green border-augusto-green/40" },
  respondido_cliente: { label: "Aguardando", className: "bg-amber-100 text-amber-800 border-amber-300" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground border-border" },
};

function AdminHelpdeskListPage() {
  const fetchList = useServerFn(adminListTickets);
  const [status, setStatus] = useState<string>("todos");
  const [search, setSearch] = useState<string>("");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["helpdesk-admin-list", status, search],
    queryFn: () => fetchList({ data: { status: status as never, search } }),
    staleTime: 10_000,
  });

  return (
    <AppShell>
      <div className="max-w-5xl">
        <AdminNav />
        <div className="pb-5 border-b border-[var(--landing-rule)]">
          <span className="app-eyebrow">Suporte</span>
          <h1 className="app-title mt-2">Helpdesk</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Chamados abertos pelos usuários. Responda em até 24h úteis.</p>
        </div>

        <Card className="app-card app-card p-5 mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por protocolo ou título" className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-center gap-2 text-destructive font-medium mb-1"><AlertCircle className="h-4 w-4" /> Erro</div>
              <p className="text-muted-foreground">{error instanceof Error ? error.message : "Tente novamente."}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-muted-foreground" />
              Nenhum chamado encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--landing-rule)] rounded-md border border-border/60">
              {(data as Array<{
                id: string;
                protocolo: string;
                assunto: string;
                titulo: string;
                status: string;
                updated_at: string;
                cliente: { nome: string | null; email: string | null };
              }>).map((t) => {
                const st = STATUS_BADGE[t.status] ?? STATUS_BADGE.aberto;
                const assunto = ASSUNTOS.find((a) => a.value === t.assunto)?.label ?? t.assunto;
                return (
                  <li key={t.id}>
                    <Link
                      to="/app/admin/helpdesk/$ticketId"
                      params={{ ticketId: t.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.protocolo} · {assunto}</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground truncate">{t.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t.cliente.nome ?? "—"} · {t.cliente.email ?? "—"} · Atualizado em {new Date(t.updated_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Badge variant="outline" className={st.className}>{st.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}