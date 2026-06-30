import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building, Plus, MessageSquare } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCondominios, getProfile, getUsoMensal } from "@/lib/condominios.functions";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useHasReadyDocs } from "@/components/documentos/DocumentosPanel";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

type Condo = { id: string; nome: string; uf: string | null; qtd_unidades: number | null };

function HomePage() {
  const fetchCondos = useServerFn(listCondominios);
  const fetchProfile = useServerFn(getProfile);
  const fetchUso = useServerFn(getUsoMensal);
  const [condos, setCondos] = useState<Condo[]>([]);
  const [nome, setNome] = useState("");
  const [uso, setUso] = useState({ total_mensagens: 0 });
  const [activeCondoId, setActiveCondoId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("condoia.activeCondo"),
  );
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState<string>(() => `new-${Date.now()}`);

  useEffect(() => {
    fetchCondos()
      .then((r) => {
        const list = (r as Condo[]) ?? [];
        setCondos(list);
        if (!activeCondoId && list[0]) setActiveCondoId(list[0].id);
      })
      .catch(() => {});
    fetchProfile().then((p) => setNome((p?.nome || p?.email || "").split(" ")[0])).catch(() => {});
    fetchUso().then((u) => setUso(u as typeof uso)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeCondoId) window.localStorage.setItem("condoia.activeCondo", activeCondoId);
    setConversaId(null);
    setChatKey(`cond-${activeCondoId}-${Date.now()}`);
  }, [activeCondoId]);

  const activeCondo = useMemo(
    () => condos.find((c) => c.id === activeCondoId) ?? null,
    [condos, activeCondoId],
  );
  const hasReadyDocs = useHasReadyDocs(activeCondoId ?? "");

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-9rem)]">
        <header className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Olá{nome ? `, ${nome}` : ""}!
              <br />
              Como o CondoIA pode te ajudar hoje?
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {condos.length > 0 && (
              <Select value={activeCondoId ?? undefined} onValueChange={(v) => setActiveCondoId(v)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Selecione um condomínio" />
                </SelectTrigger>
                <SelectContent>
                  {condos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.uf ? `· ${c.uf}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Link to="/app/condominios">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
            </Link>
          </div>
        </header>

        {!activeCondo ? (
          <Card className="flex-1 flex flex-col items-center justify-center text-center p-10 border-dashed">
            <Building className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Cadastre seu primeiro condomínio para começar a conversar com o CondoIA.
            </p>
            <Link to="/app/condominios" className="mt-4">
              <Button>Cadastrar condomínio</Button>
            </Link>
          </Card>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatPanel
              key={chatKey}
              condominioId={activeCondo.id}
              hasReadyDocs={hasReadyDocs}
              initialConversaId={conversaId}
              onConversaCreated={(cid) => setConversaId(cid)}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <MessageSquare className="inline h-3 w-3 mr-1" />
                {uso.total_mensagens} mensagens este mês
              </span>
              <Link
                to="/app/condominios/$id"
                params={{ id: activeCondo.id }}
                className="hover:text-foreground"
              >
                Abrir condomínio →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}