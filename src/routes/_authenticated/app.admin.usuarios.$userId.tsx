import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  CreditCard,
  Mail,
  Receipt,
  FileCheck,
  Sliders,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  getUsuarioDetalheAdmin,
  adminUpdateSubscription,
  adminSalvarPlanoPersonalizado,
  adminUpdateUsuarioPerfil,
  calcularProximoVencimento,
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
          {/* Dados pessoais com suporte à edição pelo Super Admin */}
          <DadosPessoaisCard profile={data.profile} onSaved={() => refetch()} />

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

function DadosPessoaisCard({
  profile,
  onSaved,
}: {
  profile: UsuarioDetalhe["profile"];
  onSaved: () => void;
}) {
  const updatePerfilFn = useServerFn(adminUpdateUsuarioPerfil);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState(profile.nome || "");
  const [email, setEmail] = useState(profile.email || "");
  const [telefone, setTelefone] = useState(profile.telefone || "");
  const [oab, setOab] = useState(profile.oab || "");
  const [tipoPessoa, setTipoPessoa] = useState<"pf" | "pj">((profile.tipo_pessoa as "pf" | "pj") || "pf");
  const [cpfCnpj, setCpfCnpj] = useState(profile.cpf_cnpj || "");
  const [razaoSocial, setRazaoSocial] = useState(profile.razao_social || "");
  const [perfilAtuacao, setPerfilAtuacao] = useState(profile.perfil_atuacao || "Síndico Profissional");
  const [papelSistema, setPapelSistema] = useState<"usuario" | "super_admin" | "admin_operacional" | "admin_suporte">(
    (profile.papel_sistema as any) || "usuario",
  );
  const [ativo, setAtivo] = useState(profile.ativo ?? true);

  useEffect(() => {
    setNome(profile.nome || "");
    setEmail(profile.email || "");
    setTelefone(profile.telefone || "");
    setOab(profile.oab || "");
    setTipoPessoa((profile.tipo_pessoa as "pf" | "pj") || "pf");
    setCpfCnpj(profile.cpf_cnpj || "");
    setRazaoSocial(profile.razao_social || "");
    setPerfilAtuacao(profile.perfil_atuacao || "Síndico Profissional");
    setPapelSistema((profile.papel_sistema as any) || "usuario");
    setAtivo(profile.ativo ?? true);
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      toast.error("Nome e E-mail são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await updatePerfilFn({
        data: {
          userId: profile.id,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || null,
          oab: oab.trim() || null,
          tipo_pessoa: tipoPessoa,
          cpf_cnpj: cpfCnpj.trim() || null,
          razao_social: tipoPessoa === "pj" ? (razaoSocial.trim() || null) : null,
          perfil_atuacao: perfilAtuacao.trim() || null,
          papel_sistema: papelSistema,
          ativo,
        },
      });
      toast.success("Dados do usuário atualizados com sucesso!");
      setIsEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar dados");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setNome(profile.nome || "");
    setEmail(profile.email || "");
    setTelefone(profile.telefone || "");
    setOab(profile.oab || "");
    setTipoPessoa((profile.tipo_pessoa as "pf" | "pj") || "pf");
    setCpfCnpj(profile.cpf_cnpj || "");
    setRazaoSocial(profile.razao_social || "");
    setPerfilAtuacao(profile.perfil_atuacao || "Síndico Profissional");
    setPapelSistema((profile.papel_sistema as any) || "usuario");
    setAtivo(profile.ativo ?? true);
    setIsEditing(false);
  }

  return (
    <Card className="app-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Dados cadastrais</h2>
            <p className="text-xs text-muted-foreground">Informações pessoais, fiscais e permissões.</p>
          </div>
        </div>
        {!isEditing ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar dados
          </Button>
        ) : (
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-xs">
            Editando
          </Badge>
        )}
      </div>

      {!isEditing ? (
        <dl className="grid grid-cols-3 gap-y-2.5 text-sm">
          <Row label="Nome" value={profile.nome || "—"} />
          <Row label="E-mail" value={profile.email || "—"} />
          <Row label="Telefone" value={profile.telefone || "—"} />
          <Row label="Tipo" value={profile.tipo_pessoa?.toUpperCase() || "—"} />
          <Row label="CPF/CNPJ" value={profile.cpf_cnpj || "—"} />
          {profile.tipo_pessoa === "pj" && (
            <Row label="Razão social" value={profile.razao_social || "—"} />
          )}
          <Row label="OAB" value={profile.oab || "—"} />
          <Row label="Perfil" value={profile.perfil_atuacao || "—"} />
          <Row label="Papel no sistema" value={profile.papel_sistema?.replace(/_/g, " ").toUpperCase() || "USUÁRIO"} />
          <Row label="Status da conta" value={profile.ativo ? "Ativa" : "Bloqueada"} />
          <Row label="Último acesso" value={DATE_BR(profile.ultimo_acesso)} />
        </dl>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Nome Completo *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Marcelo Versari"
                className="h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">E-mail de Acesso *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex.: marcelo@versari.com.br"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Tipo de Pessoa</Label>
              <select
                value={tipoPessoa}
                onChange={(e) => setTipoPessoa(e.target.value as "pf" | "pj")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              >
                <option value="pf">Pessoa Física (PF)</option>
                <option value="pj">Pessoa Jurídica (PJ)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">{tipoPessoa === "pj" ? "CNPJ" : "CPF"}</Label>
              <Input
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder={tipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Telefone / WhatsApp</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="h-9 text-sm"
              />
            </div>
          </div>

          {tipoPessoa === "pj" && (
            <div className="space-y-1">
              <Label className="text-xs font-medium">Razão Social</Label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Razão Social da Empresa / Administradora"
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Inscrição OAB</Label>
              <Input
                value={oab}
                onChange={(e) => setOab(e.target.value)}
                placeholder="Ex.: 123456/SP"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Perfil de Atuação</Label>
              <select
                value={perfilAtuacao}
                onChange={(e) => setPerfilAtuacao(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              >
                <option value="Síndico Profissional">Síndico Profissional</option>
                <option value="Síndico Morador">Síndico Morador</option>
                <option value="Administradora">Administradora de Condomínio</option>
                <option value="Advogado">Advogado / Jurídico</option>
                <option value="Gestor Predial">Gestor Predial</option>
                <option value="Membro do Conselho">Membro do Conselho</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Papel no Sistema</Label>
              <select
                value={papelSistema}
                onChange={(e) => setPapelSistema(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9 font-medium"
              >
                <option value="usuario">Usuário Padrão</option>
                <option value="super_admin">Super Admin (Acesso Total)</option>
                <option value="admin_operacional">Admin Operacional</option>
                <option value="admin_suporte">Admin Suporte</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
            <div className="space-y-0.5">
              <Label htmlFor="usuario-ativo" className="text-xs font-medium cursor-pointer">
                Conta Ativa no Sistema
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Desative caso queira suspender temporariamente o acesso deste usuário à plataforma.
              </p>
            </div>
            <Switch
              id="usuario-ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="h-8 text-xs gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> Salvar Dados
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Card>
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
  const salvarPersonalizadoFn = useServerFn(adminSalvarPlanoPersonalizado);

  const [plano, setPlano] = useState<PlanId>(detalhe.subscription.plano_config_id);
  const [cortesia, setCortesia] = useState<boolean>(detalhe.subscription.cortesia);
  const [obs, setObs] = useState(detalhe.subscription.cortesia_observacao ?? "");
  const [diasExtras, setDiasExtras] = useState<string>("");
  const [creditos, setCreditos] = useState<string>(
    String(detalhe.subscription.creditos_mensagens_extras ?? 0),
  );

  // Estados específicos do Plano Personalizado
  const initialLimits = detalhe.subscription.custom_limits;
  const [customValor, setCustomValor] = useState<number>(
    detalhe.subscription.custom_preco ?? 1490,
  );
  const [customCiclo, setCustomCiclo] = useState<"mensal" | "anual">(
    detalhe.subscription.custom_ciclo ?? "mensal",
  );
  const [customBillingType, setCustomBillingType] = useState<
    "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD"
  >(detalhe.subscription.custom_billing_type ?? "UNDEFINED");
  const [customDiaVencimento, setCustomDiaVencimento] = useState<number>(
    detalhe.subscription.custom_dia_vencimento ?? 10,
  );
  const [gerarCobrancaAsaas, setGerarCobrancaAsaas] = useState<boolean>(true);
  const [enviarEmailConfirmacao, setEnviarEmailConfirmacao] = useState<boolean>(true);

  // Limites do Plano Personalizado
  const [condosIlimitados, setCondosIlimitados] = useState<boolean>(
    initialLimits?.condominiosMax === null,
  );
  const [customCondos, setCustomCondos] = useState<number>(
    initialLimits?.condominiosMax ?? 30,
  );

  const [usersIlimitados, setUsersIlimitados] = useState<boolean>(
    initialLimits?.usuariosMax === null,
  );
  const [customUsers, setCustomUsers] = useState<number>(
    initialLimits?.usuariosMax ?? 5,
  );

  const [mensagensIlimitadas, setMensagensIlimitadas] = useState<boolean>(
    initialLimits?.mensagensPorMes === null,
  );
  const [customMensagens, setCustomMensagens] = useState<number>(
    initialLimits?.mensagensPorMes ?? 2000,
  );

  const [contratosIlimitados, setContratosIlimitados] = useState<boolean>(
    initialLimits?.contratosGestaoAtiva === null,
  );
  const [customContratos, setCustomContratos] = useState<number>(
    initialLimits?.contratosGestaoAtiva ?? 80,
  );

  const [minutasAtaConvencao, setMinutasAtaConvencao] = useState<boolean>(
    initialLimits?.minutasAtaConvencao ?? true,
  );
  const [painelConsolidado, setPainelConsolidado] = useState<boolean>(
    initialLimits?.painelConsolidado ?? true,
  );
  const [relatoriosPorCondominio, setRelatoriosPorCondominio] = useState<boolean>(
    initialLimits?.relatoriosPorCondominio ?? true,
  );
  const [suportePrioritario, setSuportePrioritario] = useState<boolean>(
    initialLimits?.suportePrioritario ?? true,
  );

  const [saving, setSaving] = useState(false);

  // Sincroniza estados caso os dados do usuário sejam atualizados
  useEffect(() => {
    setPlano(detalhe.subscription.plano_config_id);
    setCortesia(detalhe.subscription.cortesia);
    setObs(detalhe.subscription.cortesia_observacao ?? "");
    setCreditos(String(detalhe.subscription.creditos_mensagens_extras ?? 0));
    if (detalhe.subscription.custom_preco !== null && detalhe.subscription.custom_preco !== undefined) {
      setCustomValor(Number(detalhe.subscription.custom_preco));
    }
    if (detalhe.subscription.custom_ciclo) {
      setCustomCiclo(detalhe.subscription.custom_ciclo);
    }
    if (detalhe.subscription.custom_billing_type) {
      setCustomBillingType(detalhe.subscription.custom_billing_type);
    }
    if (detalhe.subscription.custom_dia_vencimento) {
      setCustomDiaVencimento(Number(detalhe.subscription.custom_dia_vencimento));
    }
    const lim = detalhe.subscription.custom_limits;
    if (lim) {
      setCondosIlimitados(lim.condominiosMax === null);
      if (lim.condominiosMax !== null && lim.condominiosMax !== undefined) setCustomCondos(lim.condominiosMax);
      setUsersIlimitados(lim.usuariosMax === null);
      if (lim.usuariosMax !== null && lim.usuariosMax !== undefined) setCustomUsers(lim.usuariosMax);
      setMensagensIlimitadas(lim.mensagensPorMes === null);
      if (lim.mensagensPorMes !== null && lim.mensagensPorMes !== undefined) setCustomMensagens(lim.mensagensPorMes);
      setContratosIlimitados(lim.contratosGestaoAtiva === null);
      if (lim.contratosGestaoAtiva !== null && lim.contratosGestaoAtiva !== undefined) setCustomContratos(lim.contratosGestaoAtiva);
      if (lim.minutasAtaConvencao !== undefined) setMinutasAtaConvencao(lim.minutasAtaConvencao);
      if (lim.painelConsolidado !== undefined) setPainelConsolidado(lim.painelConsolidado);
      if (lim.relatoriosPorCondominio !== undefined) setRelatoriosPorCondominio(lim.relatoriosPorCondominio);
      if (lim.suportePrioritario !== undefined) setSuportePrioritario(lim.suportePrioritario);
    }
  }, [detalhe.subscription]);

  const isPersonalizado = plano === "personalizado";

  const proximoVenc = calcularProximoVencimento(customDiaVencimento);
  const [vencAno, vencMes, vencDia] = proximoVenc.split("-");
  const proximoVencFormatado = `${vencDia}/${vencMes}/${vencAno}`;

  async function handleSalvarGeral() {
    setSaving(true);
    try {
      if (isPersonalizado) {
        const res = await salvarPersonalizadoFn({
          data: {
            userId: detalhe.profile.id,
            valor: Number(customValor) || 0,
            ciclo: customCiclo,
            billing_type: customBillingType,
            diaVencimento: Number(customDiaVencimento) || 10,
            cortesia,
            cortesia_observacao: obs || null,
            gerarCobrancaAsaas,
            enviarEmailConfirmacao,
            limites: {
              condominiosMax: condosIlimitados ? null : Number(customCondos),
              usuariosMax: usersIlimitados ? null : Number(customUsers),
              mensagensPorMes: mensagensIlimitadas ? null : Number(customMensagens),
              contratosGestaoAtiva: contratosIlimitados ? null : Number(customContratos),
              documentosMax: null,
              minutasAtaConvencao,
              painelConsolidado,
              relatoriosPorCondominio,
              suportePrioritario,
            },
          },
        });

        if (res.asaas_subscription_id) {
          toast.success("Plano Personalizado salvo e assinatura criada no Asaas com sucesso!");
        } else if (res.asaas_error) {
          toast.warning(`Plano Personalizado salvo no sistema! Atenção Asaas: ${res.asaas_error}`);
        } else {
          toast.success("Plano Personalizado e limites atualizados com sucesso!");
        }
      } else {
        const payload: {
          userId: string;
          plano_config_id?: PlanId;
          cortesia?: boolean;
          cortesia_observacao?: string | null;
          diasExtras?: number;
          creditos_mensagens_extras?: number;
        } = { userId: detalhe.profile.id };

        payload.plano_config_id = plano;
        payload.cortesia = cortesia;
        payload.cortesia_observacao = obs || null;
        const dias = Number(diasExtras);
        if (diasExtras.trim() !== "" && Number.isFinite(dias) && dias !== 0) {
          payload.diasExtras = dias;
        }
        const cn = Number(creditos);
        if (Number.isFinite(cn)) {
          payload.creditos_mensagens_extras = cn;
        }

        await updateSub({ data: payload });
        toast.success("Assinatura atualizada com sucesso!");
      }

      setDiasExtras("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="app-card p-5 space-y-5">
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
            <Unlock className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Plano e permissões</h2>
            <p className="text-xs text-muted-foreground">
              Ajuste o plano, personalize métricas, gere cobranças no Asaas ou conceda cortesia.
            </p>
          </div>
        </div>
        {detalhe.subscription.asaas_subscription_id && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs py-1">
            <Receipt className="h-3.5 w-3.5 mr-1" /> Asaas Sub: {detalhe.subscription.asaas_subscription_id.slice(0, 14)}…
          </Badge>
        )}
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

      {/* Seleção do Plano Base */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="plano" className="text-xs font-medium">Plano do Usuário</Label>
          <select
            id="plano"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm font-medium",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
            {isPersonalizado
              ? "Configuração personalizada ativa com valores e métricas sob medida."
              : "Ao mudar para um plano pago sem cortesia, o usuário verá o checkout no próximo login."}
          </p>
        </div>

        {!isPersonalizado && (
          <div className="space-y-1.5">
            <Label htmlFor="dias" className="text-xs font-medium">Estender validade (dias)</Label>
            <Input
              id="dias"
              type="number"
              inputMode="numeric"
              placeholder="Ex.: 30"
              value={diasExtras}
              onChange={(e) => setDiasExtras(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Fim atual: <span className="font-medium text-foreground">{DATE_BR(detalhe.subscription.trial_end)}</span>
            </p>
          </div>
        )}

        {!isPersonalizado && (
          <div className="space-y-1.5">
            <Label htmlFor="creditos" className="text-xs font-medium">Créditos avulsos de mensagens</Label>
            <Input
              id="creditos"
              type="number"
              inputMode="numeric"
              min={0}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Somados ao limite mensal do plano.</p>
          </div>
        )}
      </div>

      {/* PAINEL DEDICADO: CONFIGURAÇÃO DO PLANO PERSONALIZADO */}
      {isPersonalizado && (
        <div className="space-y-5 rounded-lg border border-augusto-gold/40 bg-augusto-gold/5 p-5 mt-4">
          <div className="flex items-center gap-2 pb-2 border-b border-augusto-gold/20">
            <Sliders className="h-4 w-4 text-augusto-gold" />
            <h3 className="font-serif text-sm font-semibold text-foreground">
              Configurações Comerciais & Asaas (Plano Personalizado)
            </h3>
          </div>

          {/* 1. Condições Comerciais & Pagamento Asaas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Valor acordado (R$) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={customValor}
                onChange={(e) => setCustomValor(Number(e.target.value))}
                className="h-9 text-sm bg-background font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ciclo de cobrança</Label>
              <select
                value={customCiclo}
                onChange={(e) => setCustomCiclo(e.target.value as "mensal" | "anual")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              >
                <option value="mensal">Mensal (recorrente)</option>
                <option value="anual">Anual (recorrente)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Forma de pagamento</Label>
              <select
                value={customBillingType}
                onChange={(e) => setCustomBillingType(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9"
              >
                <option value="UNDEFINED">Indefinido (Cliente escolhe)</option>
                <option value="BOLETO">Boleto Bancário</option>
                <option value="PIX">PIX Dinâmico</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Dia do Vencimento *</Label>
                <span className="text-[11px] text-primary font-semibold">
                  Todo dia {customDiaVencimento}
                </span>
              </div>
              <select
                value={customDiaVencimento}
                onChange={(e) => setCustomDiaVencimento(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm h-9 font-medium"
              >
                {[1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 28, 30].map((dia) => (
                  <option key={dia} value={dia}>
                    Dia {dia} de cada mês
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner de Previsão de Cobrança */}
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-background/80 border border-augusto-gold/30 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 text-augusto-gold shrink-0" />
            <span>
              Cobranças mensais programadas para todo <strong>dia {customDiaVencimento}</strong>. Primeira fatura agendada para <strong>{proximoVencFormatado}</strong>.
            </span>
          </div>

          {/* Switches de Automação */}
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center justify-between gap-3 p-3 rounded-md bg-background border border-border/70 cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-augusto-green" /> Gerar cobrança automática no Asaas
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Cria a assinatura no Asaas e envia faturas por e-mail antes do vencimento.
                </span>
              </div>
              <Switch checked={gerarCobrancaAsaas} onCheckedChange={setGerarCobrancaAsaas} />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-md bg-background border border-border/70 cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-augusto-gold" /> Enviar e-mail oficial de confirmação
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Dispara e-mail de boas-vindas com o resumo dos limites e condições contratadas.
                </span>
              </div>
              <Switch checked={enviarEmailConfirmacao} onCheckedChange={setEnviarEmailConfirmacao} />
            </label>
          </div>

          {/* 2. Métricas e Limites Operacionais */}
          <div className="space-y-3 pt-3 border-t border-augusto-gold/20">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-augusto-gold" /> Métricas e Limites Operacionais do Plano
            </h4>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Condomínios */}
              <div className="space-y-1.5 p-3 rounded-md bg-background border border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Condomínios</Label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={condosIlimitados}
                      onCheckedChange={(v) => setCondosIlimitados(!!v)}
                    />
                    Ilimitado
                  </label>
                </div>
                {!condosIlimitados ? (
                  <Input
                    type="number"
                    min={1}
                    value={customCondos}
                    onChange={(e) => setCustomCondos(Number(e.target.value))}
                    className="h-8 text-xs font-medium"
                  />
                ) : (
                  <p className="text-xs text-augusto-green font-medium py-1.5">Sem limite de condomínios</p>
                )}
              </div>

              {/* Membros da Equipe */}
              <div className="space-y-1.5 p-3 rounded-md bg-background border border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Usuários / Equipe</Label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={usersIlimitados}
                      onCheckedChange={(v) => setUsersIlimitados(!!v)}
                    />
                    Ilimitado
                  </label>
                </div>
                {!usersIlimitados ? (
                  <Input
                    type="number"
                    min={1}
                    value={customUsers}
                    onChange={(e) => setCustomUsers(Number(e.target.value))}
                    className="h-8 text-xs font-medium"
                  />
                ) : (
                  <p className="text-xs text-augusto-green font-medium py-1.5">Usuários ilimitados</p>
                )}
              </div>

              {/* Mensagens IA */}
              <div className="space-y-1.5 p-3 rounded-md bg-background border border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Mensagens IA/mês</Label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={mensagensIlimitadas}
                      onCheckedChange={(v) => setMensagensIlimitadas(!!v)}
                    />
                    Ilimitado
                  </label>
                </div>
                {!mensagensIlimitadas ? (
                  <Input
                    type="number"
                    min={10}
                    step={100}
                    value={customMensagens}
                    onChange={(e) => setCustomMensagens(Number(e.target.value))}
                    className="h-8 text-xs font-medium"
                  />
                ) : (
                  <p className="text-xs text-augusto-green font-medium py-1.5">Mensagens ilimitadas</p>
                )}
              </div>

              {/* Contratos Ativos */}
              <div className="space-y-1.5 p-3 rounded-md bg-background border border-border/70">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Gestão Contratos</Label>
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={contratosIlimitados}
                      onCheckedChange={(v) => setContratosIlimitados(!!v)}
                    />
                    Ilimitado
                  </label>
                </div>
                {!contratosIlimitados ? (
                  <Input
                    type="number"
                    min={1}
                    value={customContratos}
                    onChange={(e) => setCustomContratos(Number(e.target.value))}
                    className="h-8 text-xs font-medium"
                  />
                ) : (
                  <p className="text-xs text-augusto-green font-medium py-1.5">Contratos ilimitados</p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Recursos Desbloqueados */}
          <div className="space-y-2 pt-2 border-t border-augusto-gold/20">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-augusto-green" /> Recursos Adicionais Inclusos
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center justify-between gap-2 p-2 rounded bg-background border border-border/60">
                <span>Minutas de Ata & Convenção</span>
                <Switch checked={minutasAtaConvencao} onCheckedChange={setMinutasAtaConvencao} />
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded bg-background border border-border/60">
                <span>Painel Consolidado da Carteira</span>
                <Switch checked={painelConsolidado} onCheckedChange={setPainelConsolidado} />
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded bg-background border border-border/60">
                <span>Relatórios por Condomínio</span>
                <Switch checked={relatoriosPorCondominio} onCheckedChange={setRelatoriosPorCondominio} />
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded bg-background border border-border/60">
                <span>Suporte Prioritário Dedicado</span>
                <Switch checked={suportePrioritario} onCheckedChange={setSuportePrioritario} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Botão de Salvar */}
      <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/50">
        <Button
          onClick={handleSalvarGeral}
          disabled={saving}
          variant="augusto"
          className="min-w-40 transition-all duration-200"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" /> Salvar e Aplicar
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}