import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/habilitacao")({
  component: HabilitacaoPage,
});

function HabilitacaoPage() {
  const { assembleiaId } = Route.useParams();
  const [step, setStep] = useState(1);

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-serif text-gold">Habilitação de Votantes</h1>
        
        <Tabs defaultValue="1" className="w-full" onValueChange={(v) => setStep(parseInt(v))}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="1">1 · Enviar planilha</TabsTrigger>
            <TabsTrigger value="2">2 · Leitura pela IA</TabsTrigger>
            <TabsTrigger value="3">3 · Revisar e ajustar</TabsTrigger>
            <TabsTrigger value="4">4 · Confirmar e congelar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="1">
            <Card>
              <CardHeader><CardTitle>Upload da Relação</CardTitle></CardHeader>
              <CardContent>Conteúdo do Passo 1...</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="2">
            <Card>
              <CardHeader><CardTitle>Processamento IA</CardTitle></CardHeader>
              <CardContent>Conteúdo do Passo 2...</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="3">
            <Card>
              <CardHeader><CardTitle>Revisão de Dados</CardTitle></CardHeader>
              <CardContent>Conteúdo do Passo 3...</CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="4">
            <Card>
              <CardHeader><CardTitle>Congelamento</CardTitle></CardHeader>
              <CardContent>Conteúdo do Passo 4...</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
