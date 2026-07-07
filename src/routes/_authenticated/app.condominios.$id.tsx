import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { ArrowLeft, Building, Eye } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCondominio, updateCondominio } from "@/lib/condominios.functions";
import { DocumentosPanel, useHasReadyDocs } from "@/components/documentos/DocumentosPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { UnidadesPanel } from "@/components/unidades/UnidadesPanel";
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

export const Route = createFileRoute("/_authenticated/app/condominios/$id")({
  component: CondominioDetail,
  validateSearch: (s) =>
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
  const [condo, setCondo] = useState<{ nome: string; uf: string | null; qtd_unidades: number | null; cnpj: string | null; endereco: string | null; categoria?: string | null; owner_id?: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", endereco: "", uf: "", qtd_unidades: 0, categoria: "predio" as "predio" | "casas" });
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
            qtd_unidades: row.qtd_unidades ?? 0,
            categoria: (row.categoria === "casas" ? "casas" : "predio") as
              | "predio"
              | "casas",
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
          <div>
            <h1 className="text-2xl font-bold text-primary">{condo?.nome ?? "Carregando..."}</h1>
            <p className="text-sm text-muted-foreground">{condo?.uf ?? "—"} • {condo?.qtd_unidades ?? 0} unidades</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="chat">Interação com a IA</TabsTrigger>
            <TabsTrigger value="historico">Histórico de Conversas</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="unidades">Unidades</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
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
              <Card className="p-8 text-center border-dashed">
                <p className="text-sm text-muted-foreground">Sem conversas ainda.</p>
              </Card>
            ) : (
              <Card className="divide-y">
                {conversas.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-4">
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
            <DocumentosPanel condominioId={id} readOnly={adminView} />
          </TabsContent>
          <TabsContent value="unidades">
            <UnidadesPanel condominioId={id} isOwner={canEdit} />
          </TabsContent>
          <TabsContent value="config">
            <div className="space-y-4">
              <Card className="p-6 space-y-3">
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
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {condo?.categoria === "casas" ? "Condomínio de casas" : "Prédio / apartamentos"}
                    </p>
                    <p>
                      <strong>{condo?.categoria === "casas" ? "Lotes" : "Unidades"}:</strong>{" "}
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
                            categoria: (e.target.value === "casas" ? "casas" : "predio") as
                              | "predio"
                              | "casas",
                          })
                        }
                        className="h-10 w-full border rounded-md px-3 text-sm bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                      >
                        <option value="predio">Prédio / apartamentos</option>
                        <option value="casas">Condomínio de casas</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{form.categoria === "casas" ? "Lotes" : "Unidades"}</Label>
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
                              qtd_unidades: condo.qtd_unidades ?? 0,
                              categoria: (condo.categoria === "casas" ? "casas" : "predio") as
                                | "predio"
                                | "casas",
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
                                qtd_unidades: form.qtd_unidades,
                              },
                            });
                            setCondo(saved as typeof condo);
                            setEditing(false);
                            toast.success("Dados atualizados");
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
                <Card className="p-6 space-y-4">
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
                    <div className="divide-y border rounded-md">
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
    </AppShell>
  );
}