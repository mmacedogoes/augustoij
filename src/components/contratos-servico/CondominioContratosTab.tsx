import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText, Plus, LayoutDashboard, CheckCircle2, AlertTriangle, CalendarClock, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContratoStatusBadge } from "@/components/contratos-servico/ContratoStatusBadge";
import {
  listContratosServico,
} from "@/lib/contratos-servico/contratos.functions";
import { getIndicadoresPainel } from "@/lib/contratos-servico/painel.functions";

type Row = {
  id: string;
  prestador_nome: string;
  tipo_servico_nome: string | null;
  data_fim: string | null;
  valor: number | null;
  tipo_valor: string;
  prazo_indeterminado: boolean;
  status: "vigente" | "vence_em_breve" | "vencido";
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CondominioContratosTab({ condominioId }: { condominioId: string }) {
  const listFn = useServerFn(listContratosServico);
  const indFn = useServerFn(getIndicadoresPainel);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ind, setInd] = useState<{
    vigentes: number; vencendo_90d: number; vencidos: number;
    reajustes_pendentes: number; checklists_pendentes_mes: number;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listFn({ data: { condominioId } }),
      indFn({ data: { condominioId } }),
    ])
      .then(([l, i]) => {
        setRows(l.rows as Row[]);
        setInd(i);
      })
      .catch((e: Error) => setErro(e.message));
  }, [condominioId, listFn, indFn]);

  if (erro) {
    return (
      <Card className="p-4 text-sm text-destructive">{erro}</Card>
    );
  }
  if (!rows || !ind) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos deste condomínio…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="app-eyebrow">Gestão de Contratos</p>
          <h3 className="mt-1 font-serif text-xl text-primary">Contratos deste condomínio</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/app/contratos/painel"
              search={{ cid: condominioId } as unknown as never}
            >
              <LayoutDashboard className="mr-1 h-4 w-4" /> Painel completo
            </Link>
          </Button>
          <Button size="sm" variant="augusto" asChild>
            <Link to="/app/contratos/novo">
              <Plus className="mr-1 h-4 w-4" /> Novo contrato
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniKPI icon={<CheckCircle2 />} label="Vigentes" value={ind.vigentes} tone="green" />
        <MiniKPI icon={<CalendarClock />} label="Vencem em 90d" value={ind.vencendo_90d} tone="gold" />
        <MiniKPI icon={<AlertTriangle />} label="Vencidos" value={ind.vencidos} tone="destructive" />
        <MiniKPI icon={<CalendarClock />} label="Reajustes" value={ind.reajustes_pendentes} tone="gold" />
        <MiniKPI icon={<CalendarClock />} label="Checklists mês" value={ind.checklists_pendentes_mes} tone="gold" />
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum contrato cadastrado para este condomínio.
          </p>
          <Button size="sm" variant="augusto" asChild className="mt-3">
            <Link to="/app/contratos/novo">
              <Plus className="mr-1 h-4 w-4" /> Cadastrar primeiro contrato
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/app/contratos/$contratoId"
              params={{ contratoId: r.id }}
              className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-augusto-gold/15 text-augusto-gold">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.prestador_nome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.tipo_servico_nome ?? "Sem tipo"} · vig.{" "}
                  {r.prazo_indeterminado ? "indeterminada" : `até ${formatDate(r.data_fim)}`}
                  {r.valor
                    ? ` · ${formatBRL(Number(r.valor))}${r.tipo_valor === "mensal" ? "/mês" : ""}`
                    : ""}
                </p>
              </div>
              <ContratoStatusBadge status={r.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

function MiniKPI({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "green" | "gold" | "destructive";
}) {
  const chip =
    tone === "green"
      ? "bg-augusto-green/10 text-augusto-green"
      : tone === "gold"
        ? "bg-augusto-gold/10 text-augusto-gold"
        : "bg-destructive/10 text-destructive";
  return (
    <Card className="p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-full ${chip}`}>
          <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="font-serif text-2xl leading-none text-primary">{value}</p>
    </Card>
  );
}