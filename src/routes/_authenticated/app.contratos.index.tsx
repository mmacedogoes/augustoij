import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Plus, Sparkles } from "lucide-react";
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
import { ContratoStatusBadge } from "@/components/contratos-servico/ContratoStatusBadge";
import { Proximos30DiasPanel } from "@/components/contratos-servico/Proximos30DiasPanel";
import {
  listCondominiosParaContratos,
  listContratosServico,
  listTiposServicoContrato,
  type ContratoLinha,
} from "@/lib/contratos-servico/contratos.functions";

export const Route = createFileRoute("/_authenticated/app/contratos/")({
  component: Page,
});

const TODOS = "__todos";

function Page() {
  const navigate = useNavigate();
  const listFn = useServerFn(listContratosServico);
  const condosFn = useServerFn(listCondominiosParaContratos);
  const tiposFn = useServerFn(listTiposServicoContrato);

  const [rows, setRows] = useState<ContratoLinha[] | null>(null);
  const [counters, setCounters] = useState({ vigentes: 0, vencendo: 0, vencidos: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const [condos, setCondos] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<Array<{ id: string; nome: string }>>([]);

  const [condominioId, setCondominioId] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>(TODOS);
  const [tipoId, setTipoId] = useState<string>(TODOS);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    Promise.all([condosFn(), tiposFn()])
      .then(([c, t]) => {
        setCondos(c.rows as Array<{ id: string; nome: string }>);
        setTipos(t.rows as Array<{ id: string; nome: string }>);
      })
      .catch((e: Error) => toast.error(e.message));
  }, [condosFn, tiposFn]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setErro(null);
      listFn({
        data: {
          condominioId: condominioId === TODOS ? null : condominioId,
          statusExibicao:
            status === TODOS
              ? null
              : (status as "vigente" | "vence_em_breve" | "vencido" | "suspenso" | "encerrado"),
          tipoServicoId: tipoId === TODOS ? null : tipoId,
          busca: busca.trim() === "" ? null : busca.trim(),
        },
      })
        .then((r) => {
          setRows(r.rows);
          setCounters(r.counters);
        })
        .catch((e: Error) => {
          setErro(e.message);
          toast.error(e.message);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [listFn, condominioId, status, tipoId, busca]);

  const total = useMemo(() => rows?.length ?? 0, [rows]);

  return (
    <AppShell>
      <GestaoContratosGate>
      <div className="max-w-6xl">
        <div className="mb-4">
          <ContratosTabs condominioId={condominioId === TODOS ? null : condominioId} />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <p className="app-eyebrow">Contratos de prestação de serviços</p>
            <h1 className="text-3xl font-serif text-primary">Contratos</h1>
            <p className="text-muted-foreground">
              Gestão dos contratos firmados pelos condomínios (portaria, limpeza, elevadores etc.).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/app/contratos/importar" })}>
              <Sparkles className="h-4 w-4 mr-1" /> Importar com IA
            </Button>
            <Button onClick={() => navigate({ to: "/app/contratos/novo" })}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          <Counter label="Vigentes" value={counters.vigentes} tone="emerald" />
          <Counter label="Vencendo em 90 dias" value={counters.vencendo} tone="amber" />
          <Counter label="Vencidos" value={counters.vencidos} tone="red" />
        </div>

        <div className="mb-6">
          <Proximos30DiasPanel />
        </div>

        <Card className="p-4 mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={condominioId} onValueChange={setCondominioId}>
              <SelectTrigger>
                <SelectValue placeholder="Condomínio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os condomínios</SelectItem>
                {condos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os status</SelectItem>
                <SelectItem value="vigente">Vigente</SelectItem>
                <SelectItem value="vence_em_breve">Vence em breve</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoId} onValueChange={setTipoId}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar por prestador…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </Card>

        {erro ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
        ) : rows === null ? (
          <p className="text-sm text-muted-foreground">Carregando contratos…</p>
        ) : total === 0 ? (
          <Card className="p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" strokeWidth={1.2} />
            <p className="font-medium text-primary">Nenhum contrato encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre o primeiro contrato para começar a acompanhar prestadores, vigências e obrigações.
            </p>
            <Button onClick={() => navigate({ to: "/app/contratos/novo" })}>
              <Plus className="h-4 w-4 mr-1" /> Novo contrato
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <Th>Prestador</Th>
                    <Th>Tipo de serviço</Th>
                    <Th>Condomínio</Th>
                    <Th>Vigência</Th>
                    <Th>Valor</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 cursor-pointer">
                      <Td>
                        <Link
                          to="/app/contratos/$contratoId"
                          params={{ contratoId: r.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.prestador_nome}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{r.tipo_servico_nome ?? "—"}</Td>
                      <Td className="text-muted-foreground">{r.condominio_nome}</Td>
                      <Td className="text-muted-foreground">{formatVigencia(r)}</Td>
                      <Td className="text-muted-foreground">
                        {r.valor === null
                          ? "—"
                          : `${formatBRL(Number(r.valor))}${r.tipo_valor === "mensal" ? "/mês" : ""}`}
                      </Td>
                      <Td>
                        <ContratoStatusBadge status={r.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      </GestaoContratosGate>
    </AppShell>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" }) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  };
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-3xl font-semibold ${tones[tone]}`}>{value}</p>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatVigencia(r: ContratoLinha): string {
  if (r.prazo_indeterminado) return "Indeterminado";
  const ini = r.data_inicio ? formatDate(r.data_inicio) : "—";
  const fim = r.data_fim ? formatDate(r.data_fim) : "—";
  return `${ini} até ${fim}`;
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}