import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCondominio } from "@/lib/condominios.functions";

export const Route = createFileRoute("/_authenticated/app/condominios/$id")({
  component: CondominioDetail,
});

function CondominioDetail() {
  const { id } = Route.useParams();
  const fetchCondo = useServerFn(getCondominio);
  const [condo, setCondo] = useState<{ nome: string; uf: string | null; qtd_unidades: number | null; cnpj: string | null; endereco: string | null } | null>(null);

  useEffect(() => {
    fetchCondo({ data: { id } }).then((r) => setCondo(r as typeof condo)).catch(() => {});
  }, [fetchCondo, id]);

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
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">📄 Upload de PDF/DOCX com vetorização será habilitado na próxima fase.</p>
            </Card>
          </TabsContent>
          <TabsContent value="chat">
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">💬 Chat com IA + RAG será habilitado na próxima fase.</p>
            </Card>
          </TabsContent>
          <TabsContent value="historico">
            <Card className="p-8 text-center border-dashed">
              <p className="text-sm text-muted-foreground">Sem conversas ainda.</p>
            </Card>
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