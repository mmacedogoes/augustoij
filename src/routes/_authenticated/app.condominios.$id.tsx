import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Building, Eye, MessageSquare } from "lucide-react";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCondominio, updateCondominio } from "@/lib/condominios.functions";
import { useHasReadyDocs } from "@/components/documentos/DocumentosPanel";
import { listConversas, deleteConversa } from "@/lib/chat.functions";
import { listMembros, inviteMembro, removeMembro, createOperadorPJ } from "@/lib/membros.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getProfile } from "@/lib/condominios.functions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CATEGORIAS_CONDOMINIO,
  type CategoriaCondominio,
  getCategoriaMeta,
  normalizeCategoria,
} from "@/lib/categorias-condominio";

// Painéis pesados carregam sob demanda (troca de aba).
const ChatPanel = lazy(() =>
  import("@/components/chat/ChatPanel").then((m) => ({ default: m.ChatPanel })),
);
const DocumentosPanel = lazy(() =>
  import("@/components/documentos/DocumentosPanel").then((m) => ({ default: m.DocumentosPanel })),
);
const UnidadesPanel = lazy(() =>
  import("@/components/unidades/UnidadesPanel").then((m) => ({ default: m.UnidadesPanel })),
);
const CondominioContratosTab = lazy(() =>
  import("@/components/contratos-servico/CondominioContratosTab").then((m) => ({ default: m.CondominioContratosTab })),
);

function TabSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="h-6 w-40 rounded-md bg-muted/60 animate-pulse" />
      <div className="h-32 rounded-md bg-muted/40 animate-pulse" />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/condominios/$id")({
  component: CondominioDetail,
  validateSearch: (s): { admin_view?: boolean } =>
    z
      .object({
        admin_view: z
          .union([z.literal(1), z.literal("1"), z.boolean()])
          .optional()
          .transform((v) => v === 1 || v === "1" || v === true)
          .default(false),
      })
      .parse(s),
});

function CondominioDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const wantsAdminView = !!search.admin_view;
  const fetchCondo = useServerFn(getCondominio);
  const saveCondo = useServerFn(updateCondominio);
  const fetchConversas = useServerFn(listConversas);
  const removeConversa = useServerFn(deleteConversa);
  const fetchMembros = useServerFn(listMembros);
  const inviteFn = useServerFn(inviteMembro);
  const removeFn = useServerFn(removeMembro);
  const createOperFn = useServerFn(createOperadorPJ);
  const fetchProfile = useServerFn(getProfile);
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [condo, setCondo] = useState<{ nome: string; uf: string | null; cidade: string | null; qtd_unidades: number | null; cnpj: string | null; endereco: string | null; categoria?: string | null; owner_id?: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState<{
    nome: string;
    cnpj: string;
    endereco: string;
    uf: string;
    cidade: string;
    qtd_unidades: number;
    categoria: CategoriaCondominio;
  }>({ nome: "", cnpj: "", endereco: "", uf: "", cidade: "", qtd_unidades: 0, categoria: "predio" });
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  // chave usada como `key` do ChatPanel para forçar remount limpo
  // ao trocar entre "nova conversa" e abrir uma conversa do histórico.
  const [chatKey, setChatKey] = useState<string>(() => `new-${Date.now()}`);
  const [conversas, setConversas] = useState<
    Array<{
      id: string;
      titulo: string | null;
      created_at: string;
      autor?: { nome: string | null; email: string | null } | null;
    }>
  >([]);
  const [membros, setMembros] = useState<Array<{ id: string; user_id: string; papel: string; nome: string | null; email: string | null }>>([]);
  const [emailConvite, setEmailConvite] = useState("");
  const [openCreateOper, setOpenCreateOper] = useState(false);
  const [creatingOper, setCreatingOper] = useState(false);
  const [novoOper, setNovoOper] = useState({ nome: "", email: "", password: "" });
  const [isPJ, setIsPJ] = useState(false);
  const [tab, setTab] = useState<string>("chat");
  const hasReadyDocs = useHasReadyDocs(id);

  // Quando o admin pede ?admin_view=1, validamos o papel no servidor;
  // só ativa o modo visualizador se realmente for admin.
  const adminView = wantsAdminView && isAdmin === true;

  useEffect(() => {
    if (!wantsAdminView) {
      setIsAdmin(false);
      return;
    }
    checkAdmin()
      .then((r) => setIsAdmin(!!r.admin))
      .catch(() => setIsAdmin(false));
  }, [wantsAdminView, checkAdmin]);

  useEffect(() => {
    fetchCondo({ data: { id } })
      .then((r) => {
        const row = r as typeof condo;
        setCondo(row);
        if (row) {
          setForm({
            nome: row.nome ?? "",
            cnpj: row.cnpj ?? "",
            endereco: row.endereco ?? "",
            uf: row.uf ?? "",
            cidade: row.cidade ?? "",
            qtd_unidades: row.qtd_unidades ?? 0,
            categoria: normalizeCategoria(row.categoria),
          });
        }
      })
      .catch(() => {});
    fetchProfile()
      .then((p) => {
        setIsPJ(p?.tipo_pessoa === "pj");
        setProfileId(p?.id ?? null);
      })
      .catch(() => {});
  }, [fetchCondo, fetchProfile, id]);

  const isOwner = !!profileId && !!condo?.owner_id && profileId === condo.owner_id;
  const canEdit = isOwner && !adminView;

  const refreshMembros = () => {
    fetchMembros({ data: { condominioId: id } })
      .then((rows) => setMembros(rows as typeof membros))
      .catch(() => {});
  };

  const refreshConversas = () => {
    fetchConversas({ data: { condominioId: id, adminView } })
      .then((rows) => setConversas(rows as typeof conversas))
      .catch(() => {});
  };

  useEffect(() => {
    refreshConversas();
    refreshMembros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminView]);

  return (
    <AppShell>
      <div className="max-w-5xl">
        <Link to="/app/condominios" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
        {adminView && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
            <Eye className="h-4 w-4" />
            <p className="text-xs">
              Modo <strong>visualizador (admin)</strong> — somente leitura. Você vê documentos,
              unidades e o histórico de conversas de todos os membros, mas não pode escrever, anexar
              ou excluir nada.
            </p>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-md bg-accent/10 p-3"><Building className="h-6 w-6 text-accent" /></div>
          <div className="min-w-0">
            {condo ? (
              <header className="app-page-header">
                <span className="app-eyebrow">Condomínio</span>
                <h1 className="app-title">{condo.nome}</h1>
                <p className="app-subtitle">{condo.uf ?? "—"} • {condo.qtd_unidades ?? 0} unidades</p>
              </header>
            ) : (
              <AppSkeletonLines lines={2} className="w-64" />
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="chat">Interação com a IA</TabsTrigger>
            <TabsTrigger value="historico">Histórico de Conversas</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="unidades">Unidades</TabsTrigger>
            {(canEdit || isAdmin) ? (
              <TabsTrigger value="contratos">Gestão de Contratos</TabsTrigger>
            ) : null}
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
            {tab === "chat" && (
              <Suspense fallback={<TabSkeleton />}>
                <ChatPanel
                  key={chatKey}
                  condominioId={id}
                  hasReadyDocs={hasReadyDocs}
                  initialConversaId={conversaAtiva}
                  readOnly={adminView}
                  onConversaCreated={(cid) => {
                    setConversaAtiva(cid);
                    refreshConversas();
                  }}
                />
              </Suspense>
            )}
            <div className="mt-3 flex justify-end">
              {!adminView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConversaAtiva(null);
                  setChatKey(`new-${Date.now()}`);
                }}
              >
                Nova conversa
              </Button>
              )}
            </div>
          </TabsContent>
          <TabsContent value="historico">
            {conversas.length === 0 ? (
              <Card className="app-card p-8 border-dashed">
                <AppEmptyState
                  icon={<MessageSquare />}
                  title="Sem conversas ainda"
                  description="Inicie uma conversa com a IA para vê-la aqui."
                />
              </Card>
            ) : (
              <Card className="app-card divide-y divide-[var(--landing-rule)]">
                {conversas.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors duration-[var(--dur-fast)]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.titulo || "Conversa sem título"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                        {adminView && c.autor && (
                          <span className="ml-2">· por {c.autor.nome || c.autor.email || "—"}</span>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        console.log("[historico] abrir conversa", c.id);
                        setConversaAtiva(c.id);
                        // Sempre único: força remount mesmo se reabrindo a mesma.
                        setChatKey(`${c.id}-${Date.now()}`);
                        setTab("chat");
                      }}
                    >
                      Abrir
                    </Button>
                    {!adminView && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Excluir esta conversa?")) return;
                        try {
                          await removeConversa({ data: { id: c.id } });
                          toast.success("Conversa excluída");
                          if (conversaAtiva === c.id) setConversaAtiva(null);
                          refreshConversas();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>
          <TabsContent value="documentos">
            {tab === "documentos" && (
              <Suspense fallback={<TabSkeleton />}>
                <DocumentosPanel condominioId={id} readOnly={adminView} />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="unidades">
            {tab === "unidades" && (
              <Suspense fallback={<TabSkeleton />}>
                <UnidadesPanel condominioId={id} isOwner={canEdit} />
              </Suspense>
            )}
          </TabsContent>
          {(canEdit || isAdmin) ? (
            <TabsContent value="contratos">
              {tab === "contratos" && (
                <Suspense fallback={<TabSkeleton />}>
                  <CondominioContratosTab condominioId={id} />
                </Suspense>
              )}
            </TabsContent>
          ) : null}
          <TabsContent value="config">
            <div className="space-y-4">
              <Card className="app-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Dados do condomínio</h3>
                  {canEdit && !editing && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                  )}
                </div>
                {!canEdit && (
                  <p className="text-xs text-muted-foreground">
                    {adminView
                      ? "Modo visualizador: edição desabilitada."
                      : "Apenas o dono do condomínio pode alterar estes dados."}
                  </p>
                )}
                {!editing ? (
                  <div className="space-y-1.5 text-sm">
                    <p><strong>Nome:</strong> {condo?.nome ?? "—"}</p>
                    <p><strong>CNPJ:</strong> {condo?.cnpj ?? "—"}</p>
                    <p><strong>Endereço:</strong> {condo?.endereco ?? "—"}</p>
                    <p><strong>UF:</strong> {condo?.uf ?? "—"}</p>
                    <p><strong>Cidade:</strong> {condo?.cidade ?? "—"}</p>
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {getCategoriaMeta(condo?.categoria).label}
                    </p>
                    <p>
                      <strong>{getCategoriaMeta(condo?.categoria).vocab.unidade}s:</strong>{" "}
                      {condo?.qtd_unidades ?? 0}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label>Nome</Label>
                      <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CNPJ</Label>
                      <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>UF</Label>
                      <Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cidade</Label>
                      <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: João Pessoa" />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label>Endereço</Label>
                      <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo de condomínio</Label>
                      <select
                        value={form.categoria}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            categoria: e.target.value as CategoriaCondominio,
                          })
                        }
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {CATEGORIAS_CONDOMINIO.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {getCategoriaMeta(form.categoria).descricaoCurta} — guia a IA na leitura da convenção.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{getCategoriaMeta(form.categoria).vocab.unidade}s</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.qtd_unidades}
                        onChange={(e) => setForm({ ...form, qtd_unidades: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        disabled={savingEdit}
                        onClick={() => {
                          setEditing(false);
                          if (condo) {
                            setForm({
                              nome: condo.nome ?? "",
                              cnpj: condo.cnpj ?? "",
                              endereco: condo.endereco ?? "",
                              uf: condo.uf ?? "",
                              cidade: condo.cidade ?? "",
                              qtd_unidades: condo.qtd_unidades ?? 0,
                              categoria: normalizeCategoria(condo.categoria),
                            });
                          }
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        disabled={savingEdit}
                        onClick={async () => {
                          setSavingEdit(true);
                          try {
                            const saved = await saveCondo({
                              data: {
                                id,
                                nome: form.nome.trim(),
                                cnpj: form.cnpj.trim() || null,
                                endereco: form.endereco.trim() || null,
                                uf: form.uf.trim() ? form.uf.trim().toUpperCase() : null,
                                cidade: form.cidade.trim() || null,
                                qtd_unidades: form.qtd_unidades,
                                categoria: form.categoria,
                              },
                            });
                            const savedRow = saved as (typeof condo & { cidadeNova?: boolean }) | null;
                            setCondo(savedRow);
                            setEditing(false);
                            toast.success("Dados atualizados");
                            if (savedRow?.cidadeNova) setShowDisclaimer(true);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao salvar");
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                      >
                        {savingEdit ? "Salvando…" : "Salvar"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              {isPJ && !adminView && (
                <Card className="app-card p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Operadores do condomínio</h3>
                    <p className="text-xs text-muted-foreground">
                      Convide quem já tem conta no Augusto.IJ ou crie um novo operador diretamente.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="email"
                      placeholder="email@empresa.com"
                      value={emailConvite}
                      onChange={(e) => setEmailConvite(e.target.value)}
                      className="flex-1 min-w-[220px]"
                    />
                    <Button
                      onClick={async () => {
                        if (!emailConvite.trim()) return;
                        try {
                          await inviteFn({ data: { condominioId: id, email: emailConvite.trim() } });
                          toast.success("Operador adicionado");
                          setEmailConvite("");
                          refreshMembros();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha");
                        }
                      }}
                    >
                      Convidar
                    </Button>
                    <Dialog open={openCreateOper} onOpenChange={setOpenCreateOper}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Criar operador</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar novo operador</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                          <div className="space-y-1.5">
                            <Label>Nome</Label>
                            <Input
                              value={novoOper.nome}
                              onChange={(e) => setNovoOper({ ...novoOper, nome: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              value={novoOper.email}
                              onChange={(e) => setNovoOper({ ...novoOper, email: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Senha (mín. 8 caracteres com letras e números)</Label>
                            <Input
                              type="password"
                              value={novoOper.password}
                              onChange={(e) => setNovoOper({ ...novoOper, password: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              O operador poderá acessar este condomínio com essas credenciais.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="ghost"
                            disabled={creatingOper}
                            onClick={() => setOpenCreateOper(false)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            disabled={creatingOper}
                            onClick={async () => {
                              setCreatingOper(true);
                              try {
                                const r = await createOperFn({
                                  data: {
                                    condominioId: id,
                                    nome: novoOper.nome.trim(),
                                    email: novoOper.email.trim(),
                                    password: novoOper.password,
                                  },
                                });
                                toast.success(
                                  r.reused
                                    ? "Conta já existia — vinculada ao condomínio."
                                    : "Operador criado e vinculado.",
                                );
                                setOpenCreateOper(false);
                                setNovoOper({ nome: "", email: "", password: "" });
                                refreshMembros();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Falha ao criar operador");
                              } finally {
                                setCreatingOper(false);
                              }
                            }}
                          >
                            {creatingOper ? "Criando…" : "Criar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {membros.length > 0 && (
                    <div className="divide-y divide-[var(--landing-rule)] border rounded-md">
                      {membros.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.nome ?? m.email ?? m.user_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.email ?? "—"} · {m.papel === "dono_condominio" ? "Dono" : "Operador"}
                            </p>
                          </div>
                          {m.papel !== "dono_condominio" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (!confirm("Remover este operador?")) return;
                                try {
                                  await removeFn({ data: { id: m.id } });
                                  toast.success("Removido");
                                  refreshMembros();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Falha");
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bem-vindo!</AlertDialogTitle>
            <AlertDialogDescription>
              Verifiquei que a cidade do seu condomínio é nova em meu banco de dados. Por isso, em
              até 3 dias, terei a atualização de toda a legislação condominial local. Meu banco de
              jurisprudência e legislações federais e estaduais já está a sua disposição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}