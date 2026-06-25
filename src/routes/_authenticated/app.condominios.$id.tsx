import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCondominio } from "@/lib/condominios.functions";
import { DocumentosPanel, useHasReadyDocs } from "@/components/documentos/DocumentosPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { listConversas, deleteConversa } from "@/lib/chat.functions";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/condominios/$id")({
  component: CondominioDetail,
});

function CondominioDetail() {
  const { id } = Route.useParams();
  const fetchCondo = useServerFn(getCondominio);
  const fetchConversas = useServerFn(listConversas);
  const removeConversa = useServerFn(deleteConversa);
  const [condo, setCondo] = useState<{ nome: string; uf: string | null; qtd_unidades: number | null; cnpj: string | null; endereco: string | null } | null>(null);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Array<{ id: string; titulo: string | null; created_at: string }>>([]);
  const hasReadyDocs = useHasReadyDocs(id);

  useEffect(() => {
    fetchCondo({ data: { id } }).then((r) => setCondo(r as typeof condo)).catch(() => {});
  }, [fetchCondo, id]);

  const refreshConversas = () => {
    fetchConversas({ data: { condominioId: id } })
      .then((rows) => setConversas(rows as typeof conversas))
      .catch(() => {});
  };

  useEffect(() => {
    refreshConversas();
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

        <Tabs defaultValue="documentos" className="mt-6">
          <TabsList>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="chat">Chat com IA</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="documentos">
            <DocumentosPanel condominioId={id} />
          </TabsContent>
          <TabsContent value="chat">
            <ChatPanel
              condominioId={id}
              hasReadyDocs={hasReadyDocs}
              conversaId={conversaAtiva}
              onConversaCreated={(cid) => {
                setConversaAtiva(cid);
                refreshConversas();
              }}
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setConversaAtiva(null)}>
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
                      onClick={() => setConversaAtiva(c.id)}
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
          <TabsContent value="config">
            <Card className="p-6 space-y-2">
              <p className="text-sm"><strong>CNPJ:</strong> {condo?.cnpj ?? "—"}</p>
              <p className="text-sm"><strong>Endereço:</strong> {condo?.endereco ?? "—"}</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}