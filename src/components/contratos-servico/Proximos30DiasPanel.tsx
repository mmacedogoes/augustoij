import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listEventosProximos30Dias,
  type EventoProximo,
} from "@/lib/contratos-servico/eventos.functions";
import { etiquetaTipoEvento, type TipoEvento } from "@/lib/contratos-servico/eventos-core";

export function Proximos30DiasPanel() {
  const listFn = useServerFn(listEventosProximos30Dias);
  const [rows, setRows] = useState<EventoProximo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listFn()
      .then((r) => { if (alive) setRows(r.rows); })
      .catch((e: Error) => { if (alive) setErro(e.message); });
    return () => { alive = false; };
  }, [listFn]);

  return (
    <Card className="app-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-augusto-green" />
        <h2 className="text-lg font-serif text-primary">Próximos 30 dias</h2>
      </div>
      {rows === null && !erro ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : rows && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento previsto nos próximos 30 dias.</p>
      ) : (
        <ul className="divide-y divide-[var(--landing-rule)]">
          {rows!.slice(0, 12).map((ev) => (
            <li key={ev.id}>
              <Link
                to="/app/contratos/$contratoId"
                params={{ contratoId: ev.contrato_id }}
                className="flex flex-wrap items-start justify-between gap-2 px-1 py-2 hover:bg-accent/60 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {etiquetaTipoEvento(ev.tipo as TipoEvento)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateBR(ev.data_evento)}</span>
                  </div>
                  <p className="text-sm font-medium mt-0.5 truncate">{ev.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ev.prestador_nome} · {ev.condominio_nome}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}