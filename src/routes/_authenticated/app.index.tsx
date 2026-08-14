import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building, Plus } from "lucide-react";
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
import { listCondominios, getProfile } from "@/lib/condominios.functions";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useHasReadyDocs } from "@/components/documentos/DocumentosPanel";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

type Condo = { id: string; nome: string; uf: string | null; qtd_unidades: number | null };

function HomePage() {
  const fetchCondos = useServerFn(listCondominios);
  const fetchProfile = useServerFn(getProfile);

  const condosQuery = useQuery<Condo[]>({
    queryKey: ["home", "condos"],
    queryFn: async () => ((await fetchCondos()) as Condo[]) ?? [],
    staleTime: 30_000,
  });
  const profileQuery = useQuery<{ nome?: string | null; email?: string | null }>({
    queryKey: ["home", "profile"],
    queryFn: async () => (await fetchProfile()) as { nome?: string | null; email?: string | null },
    staleTime: 5 * 60_000,
  });
  const condos = condosQuery.data ?? [];
  const nome = ((profileQuery.data?.nome || profileQuery.data?.email || "") as string).split(" ")[0];

  const [activeCondoId, setActiveCondoId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("condoia.activeCondo"),
  );
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState<string>(() => `new-${Date.now()}`);

  // Seleciona o primeiro condomínio quando a lista chega, se nada estiver ativo.
  useEffect(() => {
    if (!activeCondoId && condos[0]) setActiveCondoId(condos[0].id);
  }, [activeCondoId, condos]);

  // Toast único quando qualquer uma das cargas iniciais falha.
  useEffect(() => {
    const err = condosQuery.error ?? profileQuery.error;
    if (err) {
      toast.error("Não conseguimos carregar seus dados. Verifique sua conexão e tente novamente.");
    }
  }, [condosQuery.error, profileQuery.error]);

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

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 18) return "Boa noite";
    if (h >= 12) return "Boa tarde";
    return "Bom dia";
  }, []);

  return (
    <>
      <div className="max-w-6xl mx-auto flex flex-col -mt-2 md:-mt-6 lg:-mt-8 h-[calc(100dvh-7rem)] md:h-[calc(100dvh-8.5rem)]">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3 mb-3 border-b border-[var(--landing-rule)] sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="app-eyebrow">Área do cliente</span>
            <h1 className="app-title mt-1.5 truncate sm:whitespace-normal">
              {saudacao}{nome ? `, ${nome}` : ""}.
            </h1>
            <p className="mt-1 text-[14px] sm:text-[15px] leading-snug text-muted-foreground">
              Em que o Augusto pode ajudar?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {condos.length > 0 && (
              <Select value={activeCondoId ?? undefined} onValueChange={(v) => setActiveCondoId(v)}>
                <SelectTrigger className="w-[180px] sm:w-[240px] h-10 bg-card border-border hover:border-augusto-gold/50 transition-colors duration-200" data-tour="seletor-condominio">
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
              <Button size="sm" variant="augusto-outline">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </Link>
          </div>
        </header>

        {!activeCondo ? (
          <Card className="app-card flex-1 flex flex-col items-center justify-center text-center p-8 sm:p-12 border-dashed border-[var(--landing-rule)] bg-gradient-to-b from-card to-muted/30">
            <span className="app-icon-frame h-14 w-14 rounded-[var(--app-radius)]">
              <Building className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <h2 className="app-section-title mt-5">Comece cadastrando um condomínio</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Cadastre seu primeiro condomínio para começar a conversar com o Augusto.IJ.
            </p>
            <Link to="/app/condominios" className="mt-5">
              <Button variant="augusto">Cadastrar condomínio</Button>
            </Link>
          </Card>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col" data-tour="chat-box">
            <ChatPanel
              key={chatKey}
              condominioId={activeCondo.id}
              hasReadyDocs={hasReadyDocs}
              initialConversaId={conversaId}
              onConversaCreated={(cid) => setConversaId(cid)}
            />
            <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground">
              <Link
                to="/app/condominios/$id"
                params={{ id: activeCondo.id }}
                className="inline-flex items-center gap-1 hover:text-augusto-green transition-colors duration-200 focus-visible:outline-none focus-visible:text-augusto-green"
              >
                Abrir condomínio →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}