import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Search, UserPlus, UserCheck, UserX, ChevronRight, Sparkles, Loader2, Users, Link2 } from "lucide-react";
import { Link, MatchRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listUsuariosAdmin, setUserRole, adminCreateUser, setUserAtivo } from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";

export const Route = createFileRoute("/_authenticated/app/admin/usuarios/")({
  component: AdminUsuariosPage,
});

type UserRow = {
  id: string;
  email: string;
  nome: string;
  oab: string | null;
  plano: string;
  plano_config_id?: string;
  cortesia?: boolean;
  vinculado_a_id?: string | null;
  vinculado_a_nome?: string | null;
  vinculado_a_email?: string | null;
  total_condominios: number;
  mensagens_mes: number;
  is_admin: boolean;
  ativo: boolean;
  created_at: string;
};

function AdminUsuariosPage() {
  const fetchUsers = useServerFn(listUsuariosAdmin);
  const updateRole = useServerFn(setUserRole);
  const createUserFn = useServerFn(adminCreateUser);
  const toggleAtivoFn = useServerFn(setUserAtivo);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    password: "",
    papel: "cliente_pf" as
      | "super_admin"
      | "admin_operacional"
      | "admin_suporte"
      | "cliente_pf"
      | "cliente_pj_dono"
      | "cliente_pj_operador",
    perfil_atuacao: "" as "" | "sindico" | "advogado" | "administradora" | "conselheiro" | "outro",
    tipo_acesso: "cortesia" as "cortesia" | "plano_pago",
    plano_pago:
      "essencial" as "essencial" | "profissional" | "gestao" | "administradora" | "personalizado",
    observacao: "",
  });

  const {
    data: rows = [],
    isFetching: loading,
    refetch,
  } = useQuery({
    queryKey: ["admin-usuarios", appliedSearch],
    queryFn: () => fetchUsers({ data: { search: appliedSearch, limit: 50, offset: 0 } }) as Promise<UserRow[]>,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    refetch().catch((e) => toast.error(e instanceof Error ? e.message : "Falha"));
  }, [refetch]);

  const toggleAdmin = async (u: UserRow) => {
    const grant = !u.is_admin;
    if (!confirm(grant ? `Conceder admin a ${u.email}?` : `Remover admin de ${u.email}?`)) return;
    try {
      await updateRole({
        data: { userId: u.id, papel: grant ? "admin_operacional" : "cliente_pf" },
      });
      toast.success("Perfil atualizado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const toggleAtivo = async (u: UserRow) => {
    const novoAtivo = !u.ativo;
    const msg = novoAtivo
      ? `Reativar a conta de ${u.email}? O login voltará a ser permitido.`
      : `Desativar a conta de ${u.email}? O usuário não conseguirá mais fazer login, mas os dados serão preservados.`;
    if (!confirm(msg)) return;
    try {
      await toggleAtivoFn({ data: { userId: u.id, ativo: novoAtivo } });
      toast.success(novoAtivo ? "Usuário reativado" : "Usuário desativado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <>
      <div className="max-w-6xl">
        <div className="flex items-start justify-between gap-3">
          <header className="app-page-header">
            <span className="app-eyebrow">Administração</span>
            <h1 className="app-title">Usuários</h1>
            <p className="app-subtitle">Gerencie papéis, perfis e atividade dos usuários do Augusto.IJ.</p>
          </header>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Criar usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar usuário manualmente</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={newUser.nome}
                    onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha (mín. 8 caracteres com letras e números)</Label>
                  <Input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Papel no sistema</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={newUser.papel}
                    onChange={(e) =>
                      setNewUser({ ...newUser, papel: e.target.value as typeof newUser.papel })
                    }
                  >
                    <option value="cliente_pf">Cliente PF</option>
                    <option value="cliente_pj_dono">Cliente PJ — Dono</option>
                    <option value="cliente_pj_operador">Cliente PJ — Operador</option>
                    <option value="admin_suporte">Admin — Suporte</option>
                    <option value="admin_operacional">Admin — Operacional</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Perfil de atuação</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={newUser.perfil_atuacao}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        perfil_atuacao: e.target.value as typeof newUser.perfil_atuacao,
                      })
                    }
                  >
                    <option value="">— Não informar —</option>
                    <option value="sindico">Síndico</option>
                    <option value="advogado">Advogado(a)</option>
                    <option value="administradora">Administradora</option>
                    <option value="conselheiro">Conselheiro</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Tipo de acesso
                  </Label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { v: "cortesia", label: "Cortesia", hint: "Sem limites de IA, uploads ou condomínios" },
                      { v: "plano_pago", label: "Plano pago", hint: "Redireciona ao pagamento no 1º login" },
                    ].map((o) => {
                      const active = newUser.tipo_acesso === o.v;
                      return (
                        <button
                          type="button"
                          key={o.v}
                          onClick={() => setNewUser({ ...newUser, tipo_acesso: o.v as typeof newUser.tipo_acesso })}
                          className={`text-left rounded-md border px-3 py-2 text-xs transition-all duration-200 ${
                            active
                              ? "border-primary bg-primary/5 text-foreground shadow-sm"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          <p className="font-medium">{o.label}</p>
                          <p className="mt-0.5 text-[11px] opacity-80">{o.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                  {newUser.tipo_acesso === "plano_pago" && (
                    <div className="pt-2">
                      <Label className="text-xs">Plano a cobrar</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={newUser.plano_pago}
                        onChange={(e) => setNewUser({ ...newUser, plano_pago: e.target.value as typeof newUser.plano_pago })}
                      >
                        <option value="essencial">Essencial</option>
                        <option value="profissional">Profissional</option>
                        <option value="gestao">Gestão</option>
                        <option value="administradora">Administradora</option>
                        <option value="personalizado">Personalizado</option>
                      </select>
                    </div>
                  )}
                  {newUser.tipo_acesso === "cortesia" && (
                    <div className="pt-2">
                      <Label className="text-xs">Observação (opcional)</Label>
                      <Input
                        className="mt-1"
                        placeholder="Ex.: parceiro estratégico, cliente teste…"
                        value={newUser.observacao}
                        onChange={(e) => setNewUser({ ...newUser, observacao: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenCreate(false)} disabled={creating}>
                  Cancelar
                </Button>
                <Button
                  disabled={creating}
                  onClick={async () => {
                    setCreating(true);
                    try {
                      await createUserFn({
                        data: {
                          nome: newUser.nome.trim(),
                          email: newUser.email.trim(),
                          password: newUser.password,
                          papel: newUser.papel,
                          ...(newUser.perfil_atuacao
                            ? { perfil_atuacao: newUser.perfil_atuacao }
                            : {}),
                          cortesia: newUser.tipo_acesso === "cortesia",
                          ...(newUser.tipo_acesso === "plano_pago"
                            ? { plano_config_id: newUser.plano_pago }
                            : { plano_config_id: "personalizado" as const }),
                          ...(newUser.tipo_acesso === "cortesia" && newUser.observacao.trim()
                            ? { observacao: newUser.observacao.trim() }
                            : {}),
                        },
                      });
                      toast.success("Usuário criado");
                      setOpenCreate(false);
                      setNewUser({
                        nome: "",
                        email: "",
                        password: "",
                        papel: "cliente_pf",
                        perfil_atuacao: "",
                        tipo_acesso: "cortesia",
                        plano_pago: "essencial",
                        observacao: "",
                      });
                      refresh();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha ao criar usuário");
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  {creating ? "Criando…" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-6">
          <AdminNav />
        </div>

        <Card className="app-card p-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(search.trim());
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Buscar por nome, e-mail ou OAB"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <Card className="app-card divide-y divide-[var(--landing-rule)]">
          {loading && rows.length === 0 ? (
            <div className="p-4">
              <AppSkeletonLines lines={5} />
            </div>
          ) : rows.length === 0 ? (
            <AppEmptyState icon={<Users />} title="Nenhum usuário encontrado" />
          ) : (
            rows.map((u) => (
              <div
                key={u.id}
                className={`p-4 flex flex-wrap items-center gap-3 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)] ${u.ativo ? "" : "opacity-70"}`}
              >
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-primary">{u.nome || "—"}</p>
                    {u.vinculado_a_id && (
                      <Badge
                        className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-[11px] py-0"
                        title={`Usuário vinculado à conta de ${u.vinculado_a_nome || u.vinculado_a_email || "Titular"}`}
                      >
                        <Link2 className="h-3 w-3 mr-1" /> Vinculado a {u.vinculado_a_nome || u.vinculado_a_email || "Titular"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.oab && <p className="text-xs text-muted-foreground">OAB: {u.oab}</p>}
                </div>
                <div className="text-xs text-muted-foreground min-w-[130px] space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[11px] font-medium capitalize border-border/80 py-0">
                      {u.plano_config_id || u.plano} {u.cortesia ? "(Cortesia)" : ""}
                    </Badge>
                  </div>
                  <p>{u.total_condominios} condomínio(s) · {u.mensagens_mes} msg(s)/mês</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 text-accent text-xs px-2 py-1">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground text-xs px-2 py-1">
                      Usuário
                    </span>
                  )}
                  {u.ativo ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-augusto-green/10 text-augusto-green text-xs px-2 py-1">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 text-destructive text-xs px-2 py-1">
                      Inativo
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={u.is_admin ? "outline" : "default"}
                  onClick={() => toggleAdmin(u)}
                >
                  {u.is_admin ? (
                    <>
                      <ShieldOff className="h-4 w-4 mr-1" /> Revogar
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-1" /> Tornar admin
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={u.ativo ? "outline" : "default"}
                  onClick={() => toggleAtivo(u)}
                >
                  {u.ativo ? (
                    <>
                      <UserX className="h-4 w-4 mr-1" /> Desativar
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-1" /> Reativar
                    </>
                  )}
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-primary transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Link
                    to="/app/admin/usuarios/$userId"
                    params={{ userId: u.id }}
                    preload="intent"
                    className="group inline-flex items-center gap-0.5"
                  >
                    Detalhes
                    <MatchRoute
                      to="/app/admin/usuarios/$userId"
                      params={{ userId: u.id }}
                      pending
                    >
                      {(match) =>
                        match ? (
                          <Loader2 className="h-4 w-4 ml-1 animate-spin" aria-label="Carregando" />
                        ) : (
                          <ChevronRight className="h-4 w-4 ml-0.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        )
                      }
                    </MatchRoute>
                  </Link>
                </Button>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}