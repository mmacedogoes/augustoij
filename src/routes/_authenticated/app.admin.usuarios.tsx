import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isCurrentUserAdmin, listUsuariosAdmin, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/app/admin/usuarios")({
  component: AdminUsuariosPage,
  beforeLoad: async () => {
    try {
      const r = await isCurrentUserAdmin();
      if (!r?.admin) throw redirect({ to: "/app" });
    } catch {
      throw redirect({ to: "/app" });
    }
  },
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
  created_at: string;
};

function AdminUsuariosPage() {
  const fetchUsers = useServerFn(listUsuariosAdmin);
  const updateRole = useServerFn(setUserRole);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

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
      await updateRole({ data: { userId: u.id, role: "admin", grant } });
      toast.success("Perfil atualizado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold text-primary">Usuários</h1>
        <p className="text-muted-foreground">Gerencie papéis e visualize atividade.</p>
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
              <div key={u.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-medium text-primary">{u.nome || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  {u.oab && <p className="text-xs text-muted-foreground">OAB: {u.oab}</p>}
                </div>
                <div className="text-xs text-muted-foreground min-w-[110px]">
                  <p>{u.total_condominios} condomínio(s)</p>
                  <p>{u.mensagens_mes} msg(s) no mês</p>
                </div>
                <div>
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 text-accent text-xs px-2 py-1">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted text-muted-foreground text-xs px-2 py-1">
                      Usuário
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
              </div>
            ))
          )}
        </Card>
      </div>
    </AppShell>
  );
}