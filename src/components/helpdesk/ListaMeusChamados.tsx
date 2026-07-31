import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, LifeBuoy, Plus, AlertCircle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMeusTickets, ASSUNTOS } from "@/lib/helpdesk.functions";
import { NovoChamadoDialog } from "./NovoChamadoDialog";

const STATUS: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-augusto-gold/20 text-augusto-green border-augusto-gold/40" },
  respondido_admin: { label: "Respondido", className: "bg-augusto-green/15 text-augusto-green border-augusto-green/40" },
  respondido_cliente: { label: "Aguardando suporte", className: "bg-amber-100 text-amber-800 border-amber-300" },
  encerrado: { label: "Encerrado", className: "bg-muted text-muted-foreground border-border" },
};

export function ListaMeusChamados() {
  const fetchList = useServerFn(listMeusTickets);
  const [novoOpen, setNovoOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["helpdesk-meus-tickets"],
    queryFn: () => fetchList(),
    staleTime: 15_000,
  });

  return (
    <Card className="app-card app-card p-6 space-y-4" id="suporte">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="app-icon-frame h-8 w-8"><LifeBuoy className="h-4 w-4" strokeWidth={1.6} /></span>
          <div>
            <h2 className="app-section-title">Suporte</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Abra um chamado e acompanhe as respostas aqui.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo chamado
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="flex items-center gap-2 text-destructive font-medium mb-1">
            <AlertCircle className="h-4 w-4" /> Não foi possível carregar
          </div>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : "Tente novamente."}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
          Você ainda não abriu nenhum chamado.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--landing-rule)] rounded-md border border-border/60">
          {data.map((t) => {
            const st = STATUS[t.status] ?? STATUS.aberto;
            const assunto = ASSUNTOS.find((a) => a.value === t.assunto)?.label ?? t.assunto;
            return (
              <li key={t.id}>
                <Link
                  to="/app/suporte/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.protocolo} · {assunto}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground truncate">{t.titulo}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Atualizado em {new Date(t.updated_at).toLocaleString("pt-BR")}
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

      <NovoChamadoDialog open={novoOpen} onOpenChange={setNovoOpen} />
    </Card>
  );
}