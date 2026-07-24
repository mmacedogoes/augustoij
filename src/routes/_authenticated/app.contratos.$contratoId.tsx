import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContratoStatusBadge } from "@/components/contratos-servico/ContratoStatusBadge";
import {
  ObrigacoesEditor,
  type Obrigacao,
} from "@/components/contratos-servico/ObrigacoesEditor";
import {
  getContratoServico,
  removeContratoServico,
} from "@/lib/contratos-servico/contratos.functions";
import { statusExibicaoContrato } from "@/lib/contratos-servico/status";

export const Route = createFileRoute("/_authenticated/app/contratos/$contratoId")({
  component: Page,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ficha = { contrato: any; obrigacoes: Obrigacao[] };

function Page() {
  const { contratoId } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getContratoServico);
  const removerFn = useServerFn(removeContratoServico);

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(() => {
    setErro(null);
    getFn({ data: { id: contratoId } })
      .then((r) => setFicha(r as Ficha))
      .catch((e: Error) => {
        setErro(e.message);
        toast.error(e.message);
      });
  }, [getFn, contratoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleExcluir() {
    setExcluindo(true);
    try {
      await removerFn({ data: { id: contratoId } });
      toast.success("Contrato excluído");
      navigate({ to: "/app/contratos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir");
    } finally {
      setExcluindo(false);
      setConfirmar(false);
    }
  }

  if (erro) {
    return (
      <AppShell>
        <div className="max-w-4xl">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate({ to: "/app/contratos" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </AppShell>
    );
  }
  if (!ficha) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando contrato…</p>
      </AppShell>
    );
  }

  const c = ficha.contrato;
  const status = statusExibicaoContrato(c);

  return (
    <AppShell>
      <div className="max-w-4xl">
        <Link to="/app/contratos" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Contratos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <p className="app-eyebrow">
              {c.tipos_servico_contrato?.nome ?? "Contrato de prestação de serviços"}
            </p>
            <h1 className="text-3xl font-serif text-primary">{c.prestador_nome}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              {c.condominios?.nome ?? "Condomínio"} <ContratoStatusBadge status={status} />
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/app/contratos/$contratoId/editar",
                  params: { contratoId },
                })
              }
            >
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button variant="destructive" onClick={() => setConfirmar(true)}>
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Bloco titulo="Prestador">
            <Item label="Nome" value={c.prestador_nome} />
            <Item label="CNPJ/CPF" value={c.prestador_documento} />
            <Item label="E-mail" value={c.prestador_email} />
            <Item label="Telefone" value={c.prestador_telefone} />
          </Bloco>
          <Bloco titulo="Objeto e tipo">
            <Item label="Tipo" value={c.tipos_servico_contrato?.nome} />
            <Item label="Objeto" value={c.objeto} />
            <Item
              label="Terceirização de mão de obra"
              value={c.terceirizacao_mao_de_obra ? "Sim" : "Não"}
            />
          </Bloco>
          <Bloco titulo="Vigência e renovação">
            <Item label="Início" value={formatDate(c.data_inicio)} />
            <Item
              label="Fim"
              value={c.prazo_indeterminado ? "Indeterminado" : formatDate(c.data_fim)}
            />
            <Item label="Renovação automática" value={c.renovacao_automatica ? "Sim" : "Não"} />
            {c.renovacao_automatica ? (
              <Item label="Aviso prévio (dias)" value={c.aviso_previo_dias} />
            ) : null}
          </Bloco>
          <Bloco titulo="Valores e pagamento">
            <Item
              label="Valor"
              value={
                c.valor === null
                  ? "—"
                  : `${formatBRL(Number(c.valor))} ${c.tipo_valor === "mensal" ? "/mês" : "(global)"}`
              }
            />
            <Item label="Dia de vencimento" value={c.dia_vencimento ?? "—"} />
          </Bloco>
          <Bloco titulo="Reajuste">
            <Item label="Índice" value={rotuloIndice(c.indice_reajuste)} />
            <Item label="Mês base" value={c.mes_base_reajuste ?? "—"} />
          </Bloco>
          <Bloco titulo="Cláusulas">
            <Item label="Multa rescisória" value={c.multa_rescisoria} />
            <Item label="Exige seguro RC" value={c.exige_seguro_rc ? "Sim" : "Não"} />
            <Item label="Garantias" value={c.garantias} />
            <Item label="Foro" value={c.foro} />
          </Bloco>
        </div>

        <Card className="p-4 mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-serif text-primary">Obrigações do contrato</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre manualmente agora. Na próxima fase, obrigações também serão extraídas
              automaticamente pela IA na importação de contratos.
            </p>
          </div>
          <ObrigacoesEditor
            contratoId={contratoId}
            itens={ficha.obrigacoes}
            onChange={carregar}
          />
        </Card>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir contrato?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todas as obrigações vinculadas a este contrato também serão removidas. Esta ação não
            pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} disabled={excluindo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
              {excluindo ? "Excluindo…" : "Excluir contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{titulo}</p>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </Card>
  );
}
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function rotuloIndice(i: string | null | undefined): string {
  switch (i) {
    case "igpm":
      return "IGP-M";
    case "ipca":
      return "IPCA";
    case "inpc":
      return "INPC";
    case "outro":
      return "Outro";
    case "nenhum":
      return "Não há";
    default:
      return "—";
  }
}