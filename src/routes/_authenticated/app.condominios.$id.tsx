import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCondominio, updateCondominio } from "@/lib/condominios.functions";
import { DocumentosPanel, useHasReadyDocs } from "@/components/documentos/DocumentosPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { listConversas, deleteConversa } from "@/lib/chat.functions";
import { listMembros, inviteMembro, removeMembro, createOperadorPJ } from "@/lib/membros.functions";
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
});

function CondominioDetail() {
  const { id } = Route.useParams();
  const fetchCondo = useServerFn(getCondominio);
  const saveCondo = useServerFn(updateCondominio);
  const fetchConversas = useServerFn(listConversas);
  const removeConversa = useServerFn(deleteConversa);
  const fetchMembros = useServerFn(listMembros);
  const inviteFn = useServerFn(inviteMembro);
  const removeFn = useServerFn(removeMembro);
  const createOperFn = useServerFn(createOperadorPJ);
  const fetchProfile = useServerFn(getProfile);
  const [condo, setCondo] = useState<{ nome: string; uf: string | null; qtd_unidades: number | null; cnpj: string | null; endereco: string | null; owner_id?: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [form, setForm] = useState({ nome: "", cnpj: "", endereco: "", uf: "", qtd_unidades: 0 });
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  // chave usada como `key` do ChatPanel para forçar remount limpo
  // ao trocar entre "nova conversa" e abrir uma conversa do histórico.
  const [chatKey, setChatKey] = useState<string>(() => `new-${Date.now()}`);
  const [conversas, setConversas] = useState<Array<{ id: string; titulo: string | null; created_at: string }>>([]);
  const [membros, setMembros] = useState<Array<{ id: string; user_id: string; papel: string; nome: string | null; email: string | null }>>([]);
  const [emailConvite, setEmailConvite] = useState("");
  const [openCreateOper, setOpenCreateOper] = useState(false);
  const [creatingOper, setCreatingOper] = useState(false);
  const [novoOper, setNovoOper] = useState({ nome: "", email: "", password: "" });
  const [isPJ, setIsPJ] = useState(false);
  const [tab, setTab] = useState<string>("chat");
  const hasReadyDocs = useHasReadyDocs(id);

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

  const refreshMembros = () => {
    fetchMembros({ data: { condominioId: id } })
      .then((rows) => setMembros(rows as typeof membros))
      .catch(() => {});
  };

  const refreshConversas = () => {
    fetchConversas({ data: { condominioId: id } })
      .then((rows) => setConversas(rows as typeof conversas))
      .catch(() => {});
  };

  useEffect(() => {
    refreshConversas();
    refreshMembros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AppShell>
      <div className="max-w-5xl">
        <Link to="/app/condominios" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
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
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
            <ChatPanel
              key={chatKey}
              condominioId={id}
              hasReadyDocs={hasReadyDocs}
              initialConversaId={conversaAtiva}
              onConversaCreated={(cid) => {
                setConversaAtiva(cid);
                refreshConversas();
              }}
            />
            <div className="mt-3 flex justify-end">
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
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setConversaAtiva(c.id);
                        setChatKey(c.id);
                        setTab("chat");
                      }}
                    >
                      Abrir
                    </Button>
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
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>
          <TabsContent value="documentos">
            <DocumentosPanel condominioId={id} />
          </TabsContent>
          <TabsContent value="config">
            <div className="space-y-4">
              <Card className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Dados do condomínio</h3>
                  {isOwner && !editing && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      Editar
                    </Button>
                  )}
                </div>
                {!isOwner && (
                  <p className="text-xs text-muted-foreground">
                    Apenas o dono do condomínio pode alterar estes dados.
                  </p>
                )}
                {!editing ? (
                  <div className="space-y-1.5 text-sm">
                    <p><strong>Nome:</strong> {condo?.nome ?? "—"}</p>
                    <p><strong>CNPJ:</strong> {condo?.cnpj ?? "—"}</p>
                    <p><strong>Endereço:</strong> {condo?.endereco ?? "—"}</p>
                    <p><strong>UF:</strong> {condo?.uf ?? "—"}</p>
                    <p><strong>Unidades:</strong> {condo?.qtd_unidades ?? 0}</p>
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
                      <Label>Unidades</Label>
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

              {isPJ && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Operadores do condomínio</h3>
                    <p className="text-xs text-muted-foreground">
                      Convide membros da sua equipe para acessar este condomínio. O usuário precisa já ter conta no CondoIA.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@empresa.com"
                      value={emailConvite}
                      onChange={(e) => setEmailConvite(e.target.value)}
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