import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Search, UserPlus, UserCheck, UserX, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/app/admin/usuarios/")({
  component: AdminUsuariosPage,
});

type UserRow = {
  id: string;
  email: string;
  nome: string;
  oab: string | null;
  plano: string;
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
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
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

  const refresh = useCallback(() => {
    setLoading(true);
    fetchUsers({ data: { search, limit: 50, offset: 0 } })
      .then((r) => setRows(r as UserRow[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha"))
      .finally(() => setLoading(false));
  }, [fetchUsers, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    <AppShell>
      <div className="max-w-6xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Usuários</h1>
            <p className="text-muted-foreground">Gerencie papéis, perfis e atividade dos usuários do Augusto.IJ.</p>
          </div>
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

        <Card className="p-4 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              refresh();
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

        <Card className="divide-y">
          {loading && rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            rows.map((u) => (
              <div
                key={u.id}
                className={`p-4 flex flex-wrap items-center gap-3 ${u.ativo ? "" : "opacity-70"}`}
              >
                <div className="flex-1 min-w-[220px]">
                  <p className="font-medium text-primary">{u.nome || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.oab && <p className="text-xs text-muted-foreground">OAB: {u.oab}</p>}
                </div>
                <div className="text-xs text-muted-foreground min-w-[110px]">
                  <p>{u.total_condominios} condomínio(s)</p>
                  <p>{u.mensagens_mes} msg(s) no mês</p>
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
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs px-2 py-1">
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
                  className="text-muted-foreground hover:text-primary"
                >
                  <Link to="/app/admin/usuarios/$userId" params={{ userId: u.id }}>
                    Detalhes <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}