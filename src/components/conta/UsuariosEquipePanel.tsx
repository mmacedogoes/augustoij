import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Lock,
  Building2,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  Eye,
  Check,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getContextoEquipe,
  listUsuariosEquipe,
  criarUsuarioEquipe,
  atualizarUsuarioEquipe,
  removerUsuarioEquipe,
  type UsuarioEquipe,
  type PermissoesEquipe,
} from "@/lib/equipe.functions";

const PERMISSOES: Array<{ key: keyof PermissoesEquipe; label: string; hint: string }> = [
  { key: "pode_gerenciar_documentos", label: "Gerenciar documentos", hint: "Enviar, editar e excluir convenção, regimento e atas" },
  { key: "pode_gerenciar_contratos", label: "Gerenciar contratos", hint: "Criar, analisar e gerenciar prestadores de serviço" },
  { key: "pode_gerenciar_assembleias", label: "Gerenciar assembleias", hint: "Conduzir editais, pautas e votações" },
  { key: "pode_gerenciar_unidades", label: "Gerenciar unidades", hint: "Cadastro e gestão de unidades e condôminos" },
  { key: "pode_gerenciar_usuarios", label: "Gerenciar usuários", hint: "Convidar e vincular colaboradores" },
];

const PADRAO_LEITURA: PermissoesEquipe = {
  pode_gerenciar_contratos: false,
  pode_gerenciar_documentos: false,
  pode_gerenciar_assembleias: false,
  pode_gerenciar_unidades: false,
  pode_gerenciar_usuarios: false,
};

const PADRAO_TOTAL: PermissoesEquipe = {
  pode_gerenciar_contratos: true,
  pode_gerenciar_documentos: true,
  pode_gerenciar_assembleias: true,
  pode_gerenciar_unidades: true,
  pode_gerenciar_usuarios: true,
};

function getIniciais(nome: string | null, email: string | null): string {
  if (nome && nome.trim().length > 0) {
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    return partes[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

export function UsuariosEquipePanel() {
  const ctxFn = useServerFn(getContextoEquipe);
  const listFn = useServerFn(listUsuariosEquipe);
  const criarFn = useServerFn(criarUsuarioEquipe);
  const atualizarFn = useServerFn(atualizarUsuarioEquipe);
  const removerFn = useServerFn(removerUsuarioEquipe);

  const [ctx, setCtx] = useState<{
    liberado: boolean;
    planoId: string;
    limiteUsuarios: number | null;
    condominios: Array<{ id: string; nome: string }>;
  } | null>(null);

  const [rows, setRows] = useState<UsuarioEquipe[] | null>(null);

  // Modal de Criação
  const [modalCriarOpen, setModalCriarOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criarTodos, setCriarTodos] = useState(true);
  const [criarSelecionados, setCriarSelecionados] = useState<string[]>([]);
  const [criarPermissoes, setCriarPermissoes] = useState<PermissoesEquipe>(PADRAO_LEITURA);
  const [buscaCondosCriar, setBuscaCondosCriar] = useState("");

  // Modal de Edição de Acessos
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioEquipe | null>(null);
  const [editTodos, setEditTodos] = useState(false);
  const [editSelecionados, setEditSelecionados] = useState<string[]>([]);
  const [editPermissoes, setEditPermissoes] = useState<PermissoesEquipe>(PADRAO_LEITURA);
  const [buscaCondosEdit, setBuscaCondosEdit] = useState("");

  // Confirmação de Remoção
  const [usuarioParaRemover, setUsuarioParaRemover] = useState<UsuarioEquipe | null>(null);

  const [salvando, setSalvando] = useState(false);

  function carregar() {
    listFn()
      .then((r) => setRows(r.rows))
      .catch((e: Error) => toast.error(e.message));
  }

  useEffect(() => {
    ctxFn()
      .then(setCtx)
      .catch((e: Error) => toast.error(e.message));
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCondosConta = ctx?.condominios.length ?? 0;

  // Filtragem de condomínios no modal de criação
  const condominiosFiltradosCriar = useMemo(() => {
    if (!ctx?.condominios) return [];
    if (!buscaCondosCriar.trim()) return ctx.condominios;
    const term = buscaCondosCriar.toLowerCase();
    return ctx.condominios.filter((c) => c.nome.toLowerCase().includes(term));
  }, [ctx?.condominios, buscaCondosCriar]);

  // Filtragem de condomínios no modal de edição
  const condominiosFiltradosEdit = useMemo(() => {
    if (!ctx?.condominios) return [];
    if (!buscaCondosEdit.trim()) return ctx.condominios;
    const term = buscaCondosEdit.toLowerCase();
    return ctx.condominios.filter((c) => c.nome.toLowerCase().includes(term));
  }, [ctx?.condominios, buscaCondosEdit]);

  function abrirModalEditar(u: UsuarioEquipe) {
    const idsVinculados = u.condominios.map((c) => c.condominio_id);
    const todosVinculados = totalCondosConta > 0 && idsVinculados.length >= totalCondosConta;
    const atualPerms = u.condominios[0] ?? PADRAO_LEITURA;

    setUsuarioEditando(u);
    setEditTodos(todosVinculados);
    setEditSelecionados(idsVinculados);
    setEditPermissoes({
      pode_gerenciar_contratos: atualPerms.pode_gerenciar_contratos ?? false,
      pode_gerenciar_documentos: atualPerms.pode_gerenciar_documentos ?? false,
      pode_gerenciar_assembleias: atualPerms.pode_gerenciar_assembleias ?? false,
      pode_gerenciar_unidades: atualPerms.pode_gerenciar_unidades ?? false,
      pode_gerenciar_usuarios: atualPerms.pode_gerenciar_usuarios ?? false,
    });
    setBuscaCondosEdit("");
  }

  async function handleSalvarEdicao() {
    if (!usuarioEditando || !ctx) return;
    setSalvando(true);
    const alvo = editTodos ? ctx.condominios.map((c) => c.id) : editSelecionados;

    try {
      await atualizarFn({
        data: {
          userId: usuarioEditando.user_id,
          condominioIds: alvo,
          permissoes: editPermissoes,
        },
      });
      toast.success("Acessos e permissões atualizados!");
      setUsuarioEditando(null);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar permissões.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleCriar() {
    setSalvando(true);
    try {
      await criarFn({
        data: {
          nome,
          email,
          password: senha,
          todosCondominios: criarTodos,
          condominioIds: criarTodos ? [] : criarSelecionados,
          permissoes: criarPermissoes,
        },
      });
      toast.success("Usuário criado e vinculado com sucesso!");
      setModalCriarOpen(false);
      setNome("");
      setEmail("");
      setSenha("");
      setCriarTodos(true);
      setCriarSelecionados([]);
      setCriarPermissoes(PADRAO_LEITURA);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmarRemover() {
    if (!usuarioParaRemover) return;
    try {
      await removerFn({ data: { userId: usuarioParaRemover.user_id } });
      toast.success("Acesso revogado com sucesso.");
      setUsuarioParaRemover(null);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover usuário.");
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
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <h2 className="font-serif text-lg font-medium">Equipe e Usuários</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gerencie os colaboradores da sua conta, defina a quais condomínios cada um terá acesso e configure suas permissões.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ctx?.limiteUsuarios != null && (
            <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
              {rows?.length ?? 0} de {ctx.limiteUsuarios - 1} colaboradores
            </Badge>
          )}
          <Button size="sm" variant="augusto" onClick={() => setModalCriarOpen(true)} disabled={!ctx}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo usuário
          </Button>
        </div>
      </div>

      {/* Lista de Usuários */}
      {rows === null ? (
        <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-augusto-gold" /> Carregando equipe…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center rounded-lg border border-dashed border-border/70 p-6 bg-muted/10">
          <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhum usuário adicional cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Adicione membros da sua equipe para delegar a gestão de condomínios com permissões controladas.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((u) => {
            const condosCount = u.condominios.length;
            const acessoTotal = totalCondosConta > 0 && condosCount >= totalCondosConta;
            const permsAtuais = u.condominios[0] ?? PADRAO_LEITURA;
            const permissoesAtivas = PERMISSOES.filter((p) => permsAtuais[p.key]);

            return (
              <div
                key={u.user_id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Info do Usuário */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-augusto-gold/15 text-augusto-green font-semibold flex items-center justify-center text-sm border border-augusto-gold/30">
                    {getIniciais(u.nome, u.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{u.nome || u.email}</span>
                      {acessoTotal ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium py-0"
                        >
                          <Building2 className="h-3 w-3 mr-1" /> Todos os condomínios ({condosCount})
                        </Badge>
                      ) : condosCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="bg-augusto-gold/15 text-augusto-green dark:text-augusto-gold border-augusto-gold/40 text-[11px] font-medium py-0"
                        >
                          <Building2 className="h-3 w-3 mr-1" /> {condosCount} de {totalCondosConta} condomínios
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[11px] font-normal py-0">
                          Nenhum condomínio vinculado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>

                    {/* Resumo Discreto de Permissões */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mr-1">
                        <ShieldCheck className="h-3 w-3 text-muted-foreground" /> Permissões:
                      </span>
                      {permissoesAtivas.length === PERMISSOES.length ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          Acesso Completo
                        </span>
                      ) : permissoesAtivas.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                          <Eye className="h-3 w-3" /> Apenas visualização
                        </span>
                      ) : (
                        permissoesAtivas.map((p) => (
                          <span
                            key={p.key}
                            className="text-[11px] font-normal text-muted-foreground bg-muted/80 px-2 py-0.5 rounded"
                          >
                            {p.label.replace("Gerenciar ", "")}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirModalEditar(u)}
                    className="h-8 gap-1.5 text-xs hover:border-augusto-gold hover:text-augusto-green"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Gerenciar acessos
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setUsuarioParaRemover(u)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Remover usuário"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Gerenciar Acessos e Permissões do Usuário */}
      <Dialog open={!!usuarioEditando} onOpenChange={(open) => !open && setUsuarioEditando(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-augusto-gold" />
              Acessos de {usuarioEditando?.nome || usuarioEditando?.email}
            </DialogTitle>
            <DialogDescription>
              Configure os condomínios que este colaborador poderá visualizar e suas permissões operacionais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Seção 1: Condomínios com Acesso */}
            <div className="space-y-3 rounded-lg border border-border/70 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Building2 className="h-4 w-4 text-augusto-gold" /> Condomínios com acesso
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editTodos
                      ? `Acesso concedido a todos os ${totalCondosConta} condomínios da sua carteira.`
                      : `${editSelecionados.length} de ${totalCondosConta} condomínio(s) selecionado(s).`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">Acesso a todos</span>
                  <Switch
                    checked={editTodos}
                    onCheckedChange={(checked) => {
                      setEditTodos(checked);
                      if (checked && ctx) {
                        setEditSelecionados(ctx.condominios.map((c) => c.id));
                      }
                    }}
                  />
                </div>
              </div>

              {!editTodos && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        value={buscaCondosEdit}
                        onChange={(e) => setBuscaCondosEdit(e.target.value)}
                        placeholder="Filtrar condomínios por nome..."
                        className="pl-8 h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (ctx) setEditSelecionados(ctx.condominios.map((c) => c.id));
                        }}
                      >
                        Marcar todos
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditSelecionados([])}
                      >
                        Desmarcar
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2 divide-y divide-border/30">
                    {condominiosFiltradosEdit.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">Nenhum condomínio encontrado.</p>
                    ) : (
                      condominiosFiltradosEdit.map((c) => {
                        const selecionado = editSelecionados.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-muted/50 rounded cursor-pointer text-xs"
                          >
                            <Checkbox
                              checked={selecionado}
                              onCheckedChange={(checked) => {
                                setEditSelecionados((prev) =>
                                  checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                                );
                              }}
                            />
                            <span className="font-medium text-foreground truncate">{c.nome}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seção 2: Permissões de Ação */}
            <div className="space-y-3 rounded-lg border border-border/70 p-4 bg-muted/20">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-augusto-gold" /> Permissões operacionais
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Por padrão, o usuário apenas visualiza e faz perguntas à IA.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditPermissoes(PADRAO_LEITURA)}
                  >
                    Apenas leitura
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-augusto-green font-medium hover:text-augusto-green"
                    onClick={() => setEditPermissoes(PADRAO_TOTAL)}
                  >
                    Permissão total
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {PERMISSOES.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-background/80 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground">{p.hint}</p>
                    </div>
                    <Switch
                      checked={editPermissoes[p.key]}
                      onCheckedChange={(checked) =>
                        setEditPermissoes((prev) => ({ ...prev, [p.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUsuarioEditando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="augusto" onClick={handleSalvarEdicao} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Novo Usuário */}
      <Dialog open={modalCriarOpen} onOpenChange={setModalCriarOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo colaborador</DialogTitle>
            <DialogDescription>
              Crie um novo acesso de equipe e defina os condomínios e permissões.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome completo *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Marcelo Silva"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail corporativo *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colaborador@empresa.com"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Senha provisória * (mínimo 8 dígitos com letras e números)</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="h-9 text-sm"
              />
            </div>

            {/* Condomínios */}
            <div className="space-y-2 rounded-lg border border-border/70 p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Acesso a todos os condomínios</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {criarTodos
                      ? `Terá acesso a todos os ${totalCondosConta} condomínios.`
                      : `${criarSelecionados.length} selecionado(s).`}
                  </p>
                </div>
                <Switch
                  checked={criarTodos}
                  onCheckedChange={(checked) => {
                    setCriarTodos(checked);
                    if (checked && ctx) setCriarSelecionados(ctx.condominios.map((c) => c.id));
                  }}
                />
              </div>

              {!criarTodos && (
                <div className="space-y-2 pt-2">
                  <Input
                    type="text"
                    value={buscaCondosCriar}
                    onChange={(e) => setBuscaCondosCriar(e.target.value)}
                    placeholder="Filtrar condomínios..."
                    className="h-8 text-xs"
                  />
                  <div className="max-h-36 overflow-y-auto rounded border border-border bg-background p-1.5 divide-y divide-border/30">
                    {condominiosFiltradosCriar.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1 px-1.5 hover:bg-muted text-xs cursor-pointer">
                        <Checkbox
                          checked={criarSelecionados.includes(c.id)}
                          onCheckedChange={(v) =>
                            setCriarSelecionados((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                          }
                        />
                        <span className="truncate">{c.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Permissões */}
            <div className="space-y-2 rounded-lg border border-border/70 p-3 bg-muted/20">
              <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                <Label className="text-xs font-semibold text-foreground">Permissões de ação</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setCriarPermissoes(PADRAO_LEITURA)}
                  >
                    Leitura
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[11px] text-augusto-green font-medium"
                    onClick={() => setCriarPermissoes(PADRAO_TOTAL)}
                  >
                    Total
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 pt-1">
                {PERMISSOES.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-2 text-xs py-1">
                    <span className="text-foreground">{p.label}</span>
                    <Switch
                      checked={criarPermissoes[p.key]}
                      onCheckedChange={(v) => setCriarPermissoes((prev) => ({ ...prev, [p.key]: v }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCriarOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              variant="augusto"
              onClick={handleCriar}
              disabled={salvando || !nome.trim() || !email.trim() || senha.length < 8}
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando…
                </>
              ) : (
                "Criar usuário"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: Confirmação de Remoção */}
      <AlertDialog open={!!usuarioParaRemover} onOpenChange={(open) => !open && setUsuarioParaRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso do colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{usuarioParaRemover?.nome || usuarioParaRemover?.email}</strong> perderá o acesso a todos os condomínios da sua conta. Essa ação pode ser revertida recriando o usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarRemover}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Revogar acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
