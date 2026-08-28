import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Users, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  getContextoEquipe, listUsuariosEquipe, criarUsuarioEquipe,
  atualizarUsuarioEquipe, removerUsuarioEquipe,
  type UsuarioEquipe, type PermissoesEquipe,
} from "@/lib/equipe.functions";

const PERMISSOES: Array<{ key: keyof PermissoesEquipe; label: string; hint: string }> = [
  { key: "pode_gerenciar_documentos", label: "Gerenciar documentos", hint: "Inclui excluir documentos" },
  { key: "pode_gerenciar_contratos", label: "Gerenciar contratos", hint: "Criar, editar e excluir contratos" },
  { key: "pode_gerenciar_assembleias", label: "Gerenciar assembleias", hint: "Conduzir assembleias e votações" },
  { key: "pode_gerenciar_unidades", label: "Gerenciar unidades", hint: "Cadastro de unidades e condôminos" },
  { key: "pode_gerenciar_usuarios", label: "Gerenciar usuários", hint: "Convidar outros usuários" },
];

const PADRAO: PermissoesEquipe = {
  pode_gerenciar_contratos: false,
  pode_gerenciar_documentos: false,
  pode_gerenciar_assembleias: false,
  pode_gerenciar_unidades: false,
  pode_gerenciar_usuarios: false,
};

export function UsuariosEquipePanel() {
  const ctxFn = useServerFn(getContextoEquipe);
  const listFn = useServerFn(listUsuariosEquipe);
  const criarFn = useServerFn(criarUsuarioEquipe);
  const atualizarFn = useServerFn(atualizarUsuarioEquipe);
  const removerFn = useServerFn(removerUsuarioEquipe);

  const [ctx, setCtx] = useState<{
    liberado: boolean; planoId: string; limiteUsuarios: number | null;
    condominios: Array<{ id: string; nome: string }>;
  } | null>(null);
  const [rows, setRows] = useState<UsuarioEquipe[] | null>(null);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [todos, setTodos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [permissoes, setPermissoes] = useState<PermissoesEquipe>(PADRAO);

  function carregar() {
    listFn().then((r) => setRows(r.rows)).catch((e: Error) => toast.error(e.message));
  }

  useEffect(() => {
    ctxFn().then(setCtx).catch((e: Error) => toast.error(e.message));
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCriar() {
    setSalvando(true);
    try {
      await criarFn({
        data: {
          nome, email, password: senha,
          todosCondominios: todos,
          condominioIds: todos ? [] : selecionados,
          permissoes,
        },
      });
      toast.success("Usuário criado e vinculado aos condomínios.");
      setOpen(false);
      setNome(""); setEmail(""); setSenha(""); setTodos(true); setSelecionados([]); setPermissoes(PADRAO);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function handlePermissao(u: UsuarioEquipe, key: keyof PermissoesEquipe, valor: boolean) {
    const atual = u.condominios[0];
    const perms: PermissoesEquipe = {
      pode_gerenciar_contratos: atual?.pode_gerenciar_contratos ?? false,
      pode_gerenciar_documentos: atual?.pode_gerenciar_documentos ?? false,
      pode_gerenciar_assembleias: atual?.pode_gerenciar_assembleias ?? false,
      pode_gerenciar_unidades: atual?.pode_gerenciar_unidades ?? false,
      pode_gerenciar_usuarios: atual?.pode_gerenciar_usuarios ?? false,
      [key]: valor,
    };
    try {
      await atualizarFn({
        data: {
          userId: u.user_id,
          condominioIds: u.condominios.map((c) => c.condominio_id),
          permissoes: perms,
        },
      });
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar permissões.");
    }
  }

  async function handleRemover(u: UsuarioEquipe) {
    try {
      await removerFn({ data: { userId: u.user_id } });
      toast.success("Acesso revogado.");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  if (ctx && !ctx.liberado) {
    return (
      <Card className="app-card p-6 space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Lock className="h-4 w-4" />
          <h2 className="font-serif text-lg">Usuários da conta</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          A criação de usuários adicionais está disponível a partir do plano Gestão.
        </p>
      </Card>
    );
  }

  return (
    <Card className="app-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-4 w-4" />
            <h2 className="font-serif text-lg">Usuários da conta</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Crie acessos para sua equipe e defina o que cada um pode fazer em cada condomínio.
            Por padrão, o usuário apenas visualiza e adiciona documentos.
          </p>
        </div>
        <Button size="sm" variant="augusto" onClick={() => setOpen(true)} disabled={!ctx}>
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </div>

      {ctx?.limiteUsuarios != null && (
        <Badge variant="outline">Limite do plano: {ctx.limiteUsuarios} usuário(s)</Badge>
      )}

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário adicional cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((u) => (
            <div key={u.user_id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{u.nome ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {u.condominios.map((c) => c.nome).join(" · ")}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleRemover(u)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {PERMISSOES.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-2 text-xs">
                    <span>
                      {p.label}
                      <span className="block text-[10px] text-muted-foreground">{p.hint}</span>
                    </span>
                    <Switch
                      checked={u.condominios[0]?.[p.key] ?? false}
                      onCheckedChange={(v) => handlePermissao(u, p.key, v)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              O usuário receberá acesso apenas aos condomínios selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha provisória</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Todos os meus condomínios</Label>
              <Switch checked={todos} onCheckedChange={setTodos} />
            </div>
            {!todos && (
              <div className="max-h-40 overflow-auto space-y-2 rounded-md border border-border p-3">
                {(ctx?.condominios ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selecionados.includes(c.id)}
                      onCheckedChange={(v) =>
                        setSelecionados((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                      }
                    />
                    {c.nome}
                  </label>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm">Permissões</Label>
              {PERMISSOES.map((p) => (
                <label key={p.key} className="flex items-center justify-between gap-2 text-xs">
                  <span>{p.label}</span>
                  <Switch
                    checked={permissoes[p.key]}
                    onCheckedChange={(v) => setPermissoes((prev) => ({ ...prev, [p.key]: v }))}
                  />
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="augusto" onClick={handleCriar} disabled={salvando || !nome || !email || senha.length < 8}>
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando…</> : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
