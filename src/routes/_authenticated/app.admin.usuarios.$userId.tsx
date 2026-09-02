import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Building2,
  MessageSquare,
  Wallet,
  Calendar,
  ShieldCheck,
  Unlock,
  Save,
  Loader2,
  Users,
  Link2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  getUsuarioDetalheAdmin,
  adminUpdateSubscription,
  type UsuarioDetalhe,
} from "@/lib/admin.functions";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { PLANS, PLAN_IDS, CLASSIFICACAO_VINCULADO, type PlanId } from "@/config/plans";
import { formatarMoeda } from "@/lib/formatters";

export const Route = createFileRoute("/_authenticated/app/admin/usuarios/$userId")({
  component: AdminUsuarioDetalhePage,
});

const BRL = (v: number) => formatarMoeda(v);
const DATE_BR = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(iso))
    : "—";

function AdminUsuarioDetalhePage() {
  const { userId } = Route.useParams();
  const fetchDetalhe = useServerFn(getUsuarioDetalheAdmin);
  const updateSub = useServerFn(adminUpdateSubscription);

  const { data, isLoading, refetch } = useQuery<UsuarioDetalhe>({
    queryKey: ["admin-usuario-detalhe", userId],
    queryFn: () => fetchDetalhe({ data: { userId } }) as unknown as Promise<UsuarioDetalhe>,
    staleTime: 10_000,
  });

  if (isLoading || !data) {
    return (
      <DetalheSkeleton />
    );
  }

  return (
    <>
      <div className="max-w-5xl space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link to="/app/admin/usuarios">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar para usuários
            </Link>
          </Button>
        </div>

        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-primary tracking-tight truncate">
              {data.profile.nome || data.profile.email || "Usuário"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{data.profile.email}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant={data.profile.ativo ? "default" : "destructive"} className="font-medium">
                {data.profile.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant="outline" className="border-border/70">
                {data.profile.papel_sistema.replace(/_/g, " ")}
              </Badge>
              {data.subscription.cortesia && (
                <Badge className="bg-augusto-green/15 text-augusto-green hover:bg-augusto-green/20 border-0">
                  <Sparkles className="h-3 w-3 mr-1" /> Cortesia
                </Badge>
              )}
              {data.vinculadoA && (
                <Badge
                  className="bg-primary/10 text-primary hover:bg-primary/15 border-0"
                  title={CLASSIFICACAO_VINCULADO.descricao}
                >
                  <Link2 className="h-3 w-3 mr-1" /> {CLASSIFICACAO_VINCULADO.nome}
                </Badge>
              )}
            </div>
            {data.vinculadoA && (
              <p className="mt-2 text-xs text-muted-foreground">
                Vinculado a{" "}
                <span className="font-medium text-foreground">
                  {data.vinculadoA.nome || data.vinculadoA.email || "titular"}
                </span>{" "}
                · {data.vinculadoA.condominio_nome}
              </p>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 app-stagger">
          <Kpi icon={Building2} label="Condomínios" value={String(data.condominios.length)} />
          <Kpi icon={MessageSquare} label="Mensagens no mês" value={data.usoMes.mensagens.toLocaleString("pt-BR")} />
          <Kpi icon={Wallet} label="Custo do mês" value={BRL(data.usoMes.custo_brl)} />
          <Kpi
            icon={Calendar}
            label="Membro desde"
            value={DATE_BR(data.profile.created_at)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Dados pessoais */}
          <Card className="app-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <h2 className="font-semibold">Dados pessoais</h2>
            </div>
            <dl className="grid grid-cols-3 gap-y-2.5 text-sm">
              <Row label="Telefone" value={data.profile.telefone || "—"} />
              <Row label="OAB" value={data.profile.oab || "—"} />
              <Row label="Tipo" value={data.profile.tipo_pessoa?.toUpperCase() || "—"} />
              <Row label="CPF/CNPJ" value={data.profile.cpf_cnpj || "—"} />
              <Row label="Razão social" value={data.profile.razao_social || "—"} />
              <Row label="Perfil" value={data.profile.perfil_atuacao || "—"} />
              <Row label="Último acesso" value={DATE_BR(data.profile.ultimo_acesso)} />
            </dl>
          </Card>

          {/* Financeiro */}
          <Card className="app-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <h2 className="font-semibold">Financeiro</h2>
            </div>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <Row label="Mensagens (mês)" value={data.usoMes.mensagens.toLocaleString("pt-BR")} />
              <Row label="Tokens (mês)" value={data.usoMes.tokens.toLocaleString("pt-BR")} />
              <Row label="Custo mês" value={BRL(data.usoMes.custo_brl)} />
              <Row
                label="Histórico total"
                value={`${data.financeiro.total_mensagens_historico.toLocaleString("pt-BR")} msg · ${BRL(data.financeiro.custo_estimado_total_brl)}`}
              />
              <Row label="Créditos avulsos" value={String(data.subscription.creditos_mensagens_extras)} />
              <Row label="Status" value={data.subscription.status} />
            </dl>
          </Card>
        </div>

        {/* Controle de plano/uso */}
        <PlanoControls detalhe={data} onSaved={() => refetch()} updateSub={updateSub} />

        {/* Condomínios */}
        <Card className="app-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="font-semibold">Condomínios ({data.condominios.length})</h2>
          </div>
          {data.condominios.length === 0 ? (
            <AppEmptyState icon={<Building2 />} title="Nenhum condomínio cadastrado" />
          ) : (
            <ul className="divide-y divide-[var(--landing-rule)]">
              {data.condominios.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.uf || "—"} · {c.qtd_unidades ?? "?"} unidades · {DATE_BR(c.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Usuários vinculados a este titular */}
        <MembrosVinculadosCard membros={data.membrosVinculados} />
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="app-card-interactive p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="col-span-1 text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-medium text-foreground truncate">{value}</dd>
    </>
  );
}

function MembrosVinculadosCard({
  membros,
}: {
  membros: UsuarioDetalhe["membrosVinculados"];
}) {
  return (
    <Card className="app-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
            <Users className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight">Usuários vinculados</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {CLASSIFICACAO_VINCULADO.descricao}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-border/70 shrink-0 tabular-nums">
          {membros.length}
        </Badge>
      </div>

      {membros.length === 0 ? (
        <AppEmptyState
          icon={<Users />}
          title="Nenhum usuário vinculado"
          description="Este titular ainda não cadastrou usuários vinculados."
        />
      ) : (
        <ul className="divide-y divide-[var(--landing-rule)] -mx-1">
          {membros.map((m) => (
            <li
              key={`${m.condominio_id}:${m.user_id}`}
              className="px-1 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.nome || m.email || "Usuário"}
                </p>
                {m.email && m.nome && (
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Building2 className="h-3 w-3" strokeWidth={1.75} /> {m.condominio_nome}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant="outline"
                  className="border-border/70 text-[11px] font-medium capitalize"
                >
                  {m.papel.replace(/_/g, " ")}
                </Badge>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-[11px]">
                  <Link2 className="h-3 w-3 mr-1" /> Vinculado
                </Badge>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  <Link
                    to="/app/admin/usuarios/$userId"
                    params={{ userId: m.user_id }}
                    preload="intent"
                  >
                    Abrir
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DetalheSkeleton() {
  return (
    <div
      className="max-w-5xl space-y-6 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-200"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Carregando detalhes do usuário…</span>
      <div className="h-8 w-40 rounded-md bg-muted/60 animate-pulse" />
      <div className="space-y-3">
        <div className="h-8 w-2/3 sm:w-1/2 rounded-md bg-muted/70 animate-pulse" />
        <div className="h-4 w-1/2 sm:w-1/3 rounded bg-muted/50 animate-pulse" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-16 rounded-full bg-muted/60 animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-muted/50 animate-pulse" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--app-radius)] border border-border/60 bg-card p-4 space-y-2.5">
            <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
            <div className="h-6 w-16 rounded bg-muted/70 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[var(--app-radius)] border border-border/60 bg-card p-5 space-y-3">
            <div className="h-5 w-32 rounded bg-muted/60 animate-pulse" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 5 }).map((__, j) => (
                <div key={j} className="h-3.5 w-full rounded bg-muted/40 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[var(--app-radius)] border border-border/60 bg-card p-5 space-y-4">
        <div className="h-5 w-44 rounded bg-muted/60 animate-pulse" />
        <div className="h-20 w-full rounded-lg bg-muted/40 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-16 rounded bg-muted/40 animate-pulse" />
          <div className="h-16 rounded bg-muted/40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function PlanoControls({
  detalhe,
  updateSub,
  onSaved,
}: {
  detalhe: UsuarioDetalhe;
  updateSub: ReturnType<typeof useServerFn<typeof adminUpdateSubscription>>;
  onSaved: () => void;
}) {
  const [plano, setPlano] = useState<PlanId>(detalhe.subscription.plano_config_id);
  const [cortesia, setCortesia] = useState<boolean>(detalhe.subscription.cortesia);
  const [obs, setObs] = useState(detalhe.subscription.cortesia_observacao ?? "");
  const [diasExtras, setDiasExtras] = useState<string>("");
  const [creditos, setCreditos] = useState<string>(
    String(detalhe.subscription.creditos_mensagens_extras ?? 0),
  );
  const [saving, setSaving] = useState(false);

  const changed =
    plano !== detalhe.subscription.plano_config_id ||
    cortesia !== detalhe.subscription.cortesia ||
    obs !== (detalhe.subscription.cortesia_observacao ?? "") ||
    diasExtras.trim() !== "" ||
    Number(creditos) !== (detalhe.subscription.creditos_mensagens_extras ?? 0);

  async function save() {
    setSaving(true);
    try {
      const payload: {
        userId: string;
        plano_config_id?: PlanId;
        cortesia?: boolean;
        cortesia_observacao?: string | null;
        diasExtras?: number;
        creditos_mensagens_extras?: number;
      } = { userId: detalhe.profile.id };
      if (plano !== detalhe.subscription.plano_config_id) payload.plano_config_id = plano;
      if (cortesia !== detalhe.subscription.cortesia) payload.cortesia = cortesia;
      if (obs !== (detalhe.subscription.cortesia_observacao ?? ""))
        payload.cortesia_observacao = obs || null;
      const dias = Number(diasExtras);
      if (diasExtras.trim() !== "" && Number.isFinite(dias) && dias !== 0)
        payload.diasExtras = dias;
      const cn = Number(creditos);
      if (Number.isFinite(cn) && cn !== detalhe.subscription.creditos_mensagens_extras)
        payload.creditos_mensagens_extras = cn;

      await updateSub({ data: payload });
      toast.success("Assinatura atualizada");
      setDiasExtras("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="app-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
          <Unlock className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-semibold">Plano e permissões</h2>
          <p className="text-xs text-muted-foreground">
            Ajuste o plano, conceda cortesia sem limites, estenda o trial ou libere créditos extras.
          </p>
        </div>
      </div>

      {/* Cortesia — destaque */}
      <div
        className={cn(
          "rounded-lg border p-4 flex items-start gap-4 transition-colors duration-200",
          cortesia
            ? "border-augusto-green/30 bg-augusto-green/5"
            : "border-border bg-muted/30",
        )}
      >
        <Switch
          id="cortesia"
          checked={cortesia}
          onCheckedChange={setCortesia}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <Label htmlFor="cortesia" className="cursor-pointer flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-augusto-green" /> Conta cortesia — sem limites
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ignora limites de mensagens, upload de documentos e cadastro de condomínios.
            Nenhum aviso de limite é exibido para o usuário.
          </p>
          {cortesia && (
            <div className="mt-2.5">
              <Input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Observação interna (ex.: parceiro estratégico)"
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <Separator className="my-5" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="plano">Plano</Label>
          <select
            id="plano"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            value={plano}
            onChange={(e) => setPlano(e.target.value as PlanId)}
          >
            {PLAN_IDS.map((id) => (
              <option key={id} value={id}>
                {PLANS[id].nome}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Ao mudar para um plano pago sem cortesia, o usuário verá o checkout no próximo login.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dias">Estender validade (dias)</Label>
          <Input
            id="dias"
            type="number"
            inputMode="numeric"
            placeholder="Ex.: 30"
            value={diasExtras}
            onChange={(e) => setDiasExtras(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Fim atual: <span className="font-medium text-foreground">{DATE_BR(detalhe.subscription.trial_end)}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="creditos">Créditos avulsos de mensagens</Label>
          <Input
            id="creditos"
            type="number"
            inputMode="numeric"
            min={0}
            value={creditos}
            onChange={(e) => setCreditos(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Somados ao limite mensal do plano.</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button
          onClick={save}
          disabled={!changed || saving}
          className="min-w-32 transition-all duration-200"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" /> Salvar alterações
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}