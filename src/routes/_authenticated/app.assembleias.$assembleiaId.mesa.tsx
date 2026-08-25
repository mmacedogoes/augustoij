import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  Play, 
  Square, 
  Plus, 
  History, 
  Users, 
  Vote, 
  Timer, 
  Mic, 
  Monitor, 
  UserPlus,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getAssembleia } from "@/lib/assembleias/assembleias.functions";
import { 
  abrirVotacaoItem, 
  encerrarVotacaoItem, 
  apurarItem 
} from "@/lib/assembleias/votacao.functions";
import { 
  getProgressoItem, 
  prorrogarVotacao, 
  anularEReabrirItem,
  abrirCabine,
  instalarAssembleia
} from "@/lib/assembleias/mesa.functions";
import { descreverResultado } from "@/lib/assembleias/resultado-texto";
import { AssembleiaSituacaoBadge } from "@/components/assembleias/AssembleiaSituacaoBadge";
import { NumeralRomano } from "@/components/assembleias/NumeralRomano";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GravacaoMesa } from "@/components/assembleias/GravacaoMesa";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/mesa")({
  component: MesaPage,
});

function MesaPage() {
  const { assembleiaId } = useParams({ from: "/_authenticated/app/assembleias/$assembleiaId/mesa" }) as any;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchAssembleia = useServerFn(getAssembleia);
  const abrirVotacao = useServerFn(abrirVotacaoItem);
  const encerrarVotacao = useServerFn(encerrarVotacaoItem);
  const apurar = useServerFn(apurarItem);
  const getProgresso = useServerFn(getProgressoItem);
  const prorrogar = useServerFn(prorrogarVotacao);
  const anularItem = useServerFn(anularEReabrirItem);
  const gerarCabine = useServerFn(abrirCabine);

  const [itemAtivoId, setItemAtivoId] = useState<string | null>(null);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [showCabineModal, setShowCabineModal] = useState(false);
  const [anularMotivo, setAnularMotivo] = useState("");
  const [unidadeCabine, setUnidadeCabine] = useState("");
  const [cabineUrl, setCabineUrl] = useState<string | null>(null);

  const { data: assembleia, isLoading } = useQuery({
    queryKey: ["assembleia-mesa", assembleiaId],
    queryFn: () => fetchAssembleia({ data: { id: assembleiaId } }),
    refetchInterval: 5000 // Polling básico para status de itens
  });

  const itemAtivo = assembleia?.itens.find((it: any) => it.situacao === 'aberto');
  
  useEffect(() => {
    if (itemAtivo) setItemAtivoId(itemAtivo.id);
  }, [itemAtivo]);

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: progresso } = useQuery({
    queryKey: ["progresso-item", itemAtivoId],
    queryFn: () => getProgresso({ data: { itemId: itemAtivoId! } }),
    enabled: !!itemAtivoId,
    refetchInterval: 3000
  });

  const restanteMs = itemAtivo?.fecha_em ? new Date(itemAtivo.fecha_em).getTime() - agora : null;
  const tempoRestante =
    restanteMs === null
      ? "--:--"
      : `${String(Math.max(0, Math.floor(restanteMs / 60000))).padStart(2, "0")}:${String(
          Math.max(0, Math.floor(restanteMs / 1000) % 60),
        ).padStart(2, "0")}`;

  const handleAbrir = async (itemId: string) => {
    toast.promise(abrirVotacao({ data: { itemId } }), {
      loading: "Abrindo votação...",
      success: () => {
        queryClient.invalidateQueries({ queryKey: ["assembleia-mesa"] });
        return "Votação aberta!";
      },
      error: (e) => e.message
    });
  };

  const handleEncerrar = async (itemId: string) => {
    toast.promise(encerrarVotacao({ data: { itemId } }), {
      loading: "Encerrando e apurando...",
      success: () => {
        queryClient.invalidateQueries({ queryKey: ["assembleia-mesa"] });
        return "Votação encerrada.";
      },
      error: (e) => e.message
    });
  };

  const handleProrrogar = async (itemId: string) => {
    toast.promise(prorrogar({ data: { itemId, segundos: 60 } }), {
      loading: "Prorrogando...",
      success: "Mais 60 segundos adicionados.",
      error: (e) => e.message
    });
  };

  const handleAnular = async () => {
    if (!itemAtivoId) return;
    toast.promise(anularItem({ data: { itemId: itemAtivoId, motivo: anularMotivo } }), {
      loading: "Anulando item...",
      success: () => {
        setShowAnularModal(false);
        setAnularMotivo("");
        queryClient.invalidateQueries({ queryKey: ["assembleia-mesa"] });
        return "Item anulado e reaberto.";
      },
      error: (e) => e.message
    });
  };

  const handleAbrirCabine = async () => {
    if (!itemAtivoId || !unidadeCabine) return;
    toast.promise(gerarCabine({ data: { itemId: itemAtivoId, unidadeId: unidadeCabine } }), {
      loading: "Gerando acesso cabine...",
      success: (res) => {
        setCabineUrl(res.url);
        return "Acesso gerado!";
      },
      error: (e) => e.message
    });
  };

  if (isLoading) return <AppShell><Skeleton className="h-screen w-full" /></AppShell>;

  return (
    <AppShell>
      <div className="max-w-[1600px] mx-auto space-y-6 animate-augusto-fade-up">
        <header className="flex items-center justify-between border-b border-augusto-gold/10 pb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}` as any })}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-serif text-primary">Painel da Mesa Diretora</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{assembleia.titulo}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <GravacaoMesa assembleiaId={assembleiaId} />
            <div className="text-right">
              <span className="block text-[10px] text-muted-foreground uppercase font-bold">Status da Sessão</span>
              <AssembleiaSituacaoBadge situacao={assembleia.situacao} />
            </div>
            <div className="h-10 w-px bg-augusto-gold/20" />
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-augusto-gold" />
              <span className="text-lg font-serif">{progresso?.totalAptos ?? 0} <small className="text-[10px] text-muted-foreground uppercase">Aptos</small></span>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr,400px] gap-8">
          <main className="space-y-8">
            {/* Item Ativo / Próximo */}
            {itemAtivo ? (
              <Card className="border-augusto-gold/30 bg-muted/5 shadow-2xl overflow-hidden">
                <div className="bg-[#00512B] p-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <NumeralRomano n={itemAtivo.ordem} className="text-2xl opacity-50" />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-70">Item em Votação</span>
                      <h2 className="text-xl font-serif">{itemAtivo.titulo}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                    <Timer className="h-5 w-5 text-augusto-gold" />
                    <span className="text-2xl font-mono font-bold">{tempoRestante}</span>
                  </div>
                </div>

                <CardContent className="p-8 space-y-8">
                  <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quórum Parcial</h3>
                        <span className="text-sm font-mono">{progresso?.totalVotaram || 0} / {progresso?.totalAptos || 0}</span>
                      </div>
                      <div className="space-y-2">
                        <Progress value={progresso?.percentual || 0} className="h-3" />
                        <p className="text-[10px] text-muted-foreground text-right italic">
                          Aproximadamente {progresso?.percentual.toFixed(1)}% das unidades aptas já votaram.
                        </p>
                      </div>

                      <div className="pt-6 grid grid-cols-2 gap-4">
                        <Button 
                          variant="outline" 
                          className="h-16 gap-3 border-augusto-gold/20"
                          onClick={() => handleProrrogar(itemAtivo.id)}
                        >
                          <Plus className="h-4 w-4" /> +60s
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="h-16 gap-3"
                          onClick={() => setShowAnularModal(true)}
                        >
                          <History className="h-4 w-4" /> Anular
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Ações da Mesa</h3>
                      <div className="grid gap-3">
                         <Button 
                            className="h-14 bg-augusto-gold hover:bg-augusto-gold/90 text-white gap-3 w-full"
                            onClick={() => setShowCabineModal(true)}
                          >
                            <Monitor className="h-4 w-4" /> Abrir Cabine Secreta
                         </Button>
                         <Button 
                            variant="secondary"
                            className="h-14 gap-3 w-full border-augusto-gold/10"
                            onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}/mesa/voto-manual` as any, search: { itemId: itemAtivo.id } as any })}
                          >
                            <Vote className="h-4 w-4 text-augusto-gold" /> Lançar Voto Nominal
                         </Button>
                      </div>
                      <Button 
                        size="lg" 
                        variant="destructive" 
                        className="w-full h-16 text-lg font-serif gap-3"
                        onClick={() => handleEncerrar(itemAtivo.id)}
                      >
                        <Square className="h-5 w-5 fill-current" /> Encerrar Votação
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="p-12 text-center border-dashed border-2 border-augusto-gold/20 bg-muted/5">
                  <Vote className="h-12 w-12 text-augusto-gold/30 mx-auto mb-4" />
                  <h3 className="text-xl font-serif text-muted-foreground">Nenhum item em votação ativa</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Selecione o próximo item da pauta abaixo para iniciar a coleta de votos.
                  </p>
                </Card>

                <div className="grid gap-4">
                   {assembleia.itens
                    .sort((a: any, b: any) => a.ordem - b.ordem)
                    .filter((it: any) => it.situacao === 'pendente')
                    .map((item: any) => (
                      <Card key={item.id} className="p-4 flex items-center justify-between border-augusto-gold/5 group hover:border-augusto-gold/20 transition-all">
                        <div className="flex items-center gap-4">
                          <NumeralRomano n={item.ordem} className="text-xl text-augusto-gold/40" />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-primary">{item.titulo}</h4>
                              {item.alerta_ia && (
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              {item.secreto ? "Voto Secreto" : "Voto Nominal"} • Quórum: {item.regra_quorum}
                            </span>
                          </div>
                        </div>
                        <Button 
                          className="bg-[#00512B] hover:bg-[#00512B]/90 gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleAbrir(item.id)}
                        >
                          <Play className="h-4 w-4 fill-current" /> Abrir Item
                        </Button>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Histórico Recente */}
            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b border-augusto-gold/10 pb-2">Itens Encerrados</h3>
              <div className="grid gap-3">
                {assembleia.itens
                  .filter((it: any) => it.situacao === 'encerrado')
                  .map((it: any) => (
                    <Card key={it.id} className="p-4 bg-muted/10 border-none flex items-center justify-between">
                       <div className="flex items-center gap-4">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="text-sm font-medium">{it.titulo}</h4>
                          <p className="text-[10px] text-muted-foreground italic">Apurado em 21/08/2026 às 20:15</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] uppercase font-bold tracking-widest text-augusto-gold">Ver Detalhes</Button>
                    </Card>
                  ))}
              </div>
            </section>
          </main>

          <aside className="space-y-8">
            {/* Fila de Fala */}
            <Card className="border-augusto-gold/10">
              <CardHeader className="pb-3 border-b border-augusto-gold/5 bg-muted/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <Mic className="h-4 w-4 text-augusto-gold" /> Fila de Fala
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-augusto-gold/5">
                  <div className="p-4 bg-augusto-gold/5 border-l-2 border-augusto-gold">
                     <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Unidade 402-B</span>
                        <span className="text-[10px] font-mono font-bold text-augusto-gold">01:12</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground">Ricardo Santos (Proprietário)</p>
                  </div>
                  <div className="p-4 opacity-50">
                     <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">Unidade 1101-A</span>
                        <span className="text-[10px] uppercase tracking-tighter">Aguardando</span>
                     </div>
                     <p className="text-[10px] text-muted-foreground">Ana Paula Lima</p>
                  </div>
                </div>
                <div className="p-4 text-center">
                  <Button variant="outline" size="sm" className="text-[10px] uppercase font-bold w-full">Ver fila completa</Button>
                </div>
              </CardContent>
            </Card>

            {/* Quadro de Avisos IA */}
            <Card className="bg-primary text-white overflow-hidden border-none">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-augusto-gold flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="text-sm font-serif">Assistente de Mesa</h4>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  "O quórum atual de 72% é suficiente para aprovação deste item por maioria simples, mas ainda restam 15 unidades adimplentes que não votaram."
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Modal Anular */}
      <Dialog open={showAnularModal} onOpenChange={setShowAnularModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Anular e Reabrir Item</DialogTitle>
            <DialogDescription>
              Esta ação invalidará todos os votos já coletados para este item e o devolverá para o estado "pendente".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Anulação (Auditoria)</Label>
              <Textarea 
                id="motivo" 
                placeholder="Ex: Erro na leitura do item pela mesa diretora..."
                value={anularMotivo}
                onChange={(e) => setAnularMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnularModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleAnular} disabled={anularMotivo.length < 20}>Confirmar Anulação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cabine */}
      <Dialog open={showCabineModal} onOpenChange={setShowCabineModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Abertura de Cabine de Votação</DialogTitle>
            <DialogDescription>
              Gere um acesso temporário para uma unidade votar de forma secreta em um dispositivo da mesa.
            </DialogDescription>
          </DialogHeader>
          
          {!cabineUrl ? (
            <div className="py-6 space-y-6">
              <div className="space-y-2">
                <Label>Selecione a Unidade Presente</Label>
                <Input 
                  placeholder="Busque por bloco ou número..." 
                  value={unidadeCabine}
                  onChange={(e) => setUnidadeCabine(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Somente unidades habilitadas e que ainda não votaram neste item aparecerão.</p>
              </div>
              <Button 
                className="w-full bg-augusto-gold hover:bg-augusto-gold/90 text-white gap-2"
                onClick={handleAbrirCabine}
                disabled={!unidadeCabine}
              >
                Gerar Acesso <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center space-y-6">
              <div className="bg-slate-100 p-8 rounded-xl inline-block mx-auto border-2 border-augusto-gold/20">
                {/* QR Code seria aqui, usando placeholder visual */}
                <div className="w-48 h-48 bg-slate-200 rounded flex items-center justify-center relative">
                   <Vote className="h-16 w-16 text-augusto-gold/20" />
                   <div className="absolute inset-0 border-4 border-[#00512B] animate-pulse rounded" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Aponte a câmera ou clique no link:</p>
                <code className="bg-muted p-2 rounded text-xs block truncate">{window.location.origin}{cabineUrl}</code>
              </div>
              <Button 
                variant="augusto" 
                className="w-full h-12"
                onClick={() => window.open(cabineUrl, '_blank')}
              >
                Abrir em Nova Guia (Modo Tablet)
              </Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => { setCabineUrl(null); setUnidadeCabine(""); }}>Gerar para Outra Unidade</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
