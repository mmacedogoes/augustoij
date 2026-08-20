import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/habilitacao")({
  component: HabilitacaoPage,
});

function HabilitacaoPage() {
  const [activeStep, setActiveStep] = useState("1");

  return (
    <AppShell>
      <div className="container mx-auto p-6 max-w-7xl space-y-8">
        <header>
          <h1 className="text-4xl font-serif text-gold-600 mb-2">Habilitação de Votantes</h1>
          <p className="text-slate-600 font-inter">Defina quem está apto a votar nesta assembleia através de importação de dados.</p>
        </header>
        
        <Tabs value={activeStep} onValueChange={setActiveStep} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-slate-100 p-1">
            <TabsTrigger value="1" className="data-[state=active]:bg-white">1 · Enviar planilha</TabsTrigger>
            <TabsTrigger value="2" className="data-[state=active]:bg-white">2 · Leitura pela IA</TabsTrigger>
            <TabsTrigger value="3" className="data-[state=active]:bg-white">3 · Revisar e ajustar</TabsTrigger>
            <TabsTrigger value="4" className="data-[state=active]:bg-white">4 · Confirmar e congelar</TabsTrigger>
          </TabsList>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <TabsContent value="1" className="m-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload do Arquivo</CardTitle>
                    <CardDescription>Formatos aceitos: XLSX, XLS, CSV e PDF (máx 10MB).</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                    <Upload className="w-12 h-12 text-slate-400 mb-4" />
                    <Button variant="outline">Selecionar Arquivo</Button>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="2" className="m-0">
                <Card>
                  <CardHeader><CardTitle>Leitura Pela IA</CardTitle></CardHeader>
                  <CardContent className="py-8 flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-gold-500 animate-spin" />
                    <p className="text-slate-600">Processando arquivo, extraindo inadimplentes...</p>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="3" className="m-0">
                <Card>
                  <CardHeader><CardTitle>Revisão e Ajustes</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500 mb-4">Revise o casamento automático das unidades.</p>
                    <div className="h-96 border rounded bg-slate-50" />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="4" className="m-0">
                <Card>
                  <CardHeader><CardTitle>Confirmar e Congelar</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded mb-4">
                      Atenção: Após congelar, a habilitação torna-se imutável.
                    </p>
                    <Button className="w-full bg-gold-600 hover:bg-gold-700">Confirmar Habilitação</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
            
            <aside className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Efeito da Confirmação</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between"><span>Aptos:</span> <span className="font-bold text-green-600">0</span></div>
                  <div className="flex justify-between"><span>Inaptos:</span> <span className="font-bold text-destructive">0</span></div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </Tabs>
      </div>
    </AppShell>
  );
}
