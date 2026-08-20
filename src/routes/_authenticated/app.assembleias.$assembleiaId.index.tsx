import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Edit2, Calendar, MapPin, Video, FileText, Send } from "lucide-react";
import { getAssembleia } from "@/lib/assembleias/assembleias.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssembleiaSituacaoBadge } from "@/components/assembleias/AssembleiaSituacaoBadge";
import { NumeralRomano } from "@/components/assembleias/NumeralRomano";
import { RevisaoIAPainel } from "@/components/assembleias/RevisaoIAPainel";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { isSuperAdmin } from "@/lib/contratos-servico/guard";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/")({
  component: Page,
});

function Page() {
  const { assembleiaId } = useParams({ from: "/_authenticated/app/assembleias/$assembleiaId/" }) as any;
  const navigate = useNavigate();
  const fetchAssembleia = useServerFn(getAssembleia);

  const { data: access, isLoading: checkingAccess } = useQuery({
    queryKey: ["assembleias-access"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isSuper: false };
      const isSuper = await isSuperAdmin({ supabase, userId: user.id });
      return { isSuper };
    }
  });

  useEffect(() => {
    if (access && !access.isSuper) {
      toast.error("Acesso negado.");
      navigate({ to: "/app" });
    }
  }, [access, navigate]);

  const { data: assembleia, isLoading, error } = useQuery({
    queryKey: ["assembleia", assembleiaId],
    queryFn: () => fetchAssembleia({ data: { id: assembleiaId } }),
    enabled: !!assembleiaId && !!access?.isSuper
  });

  if (isLoading || checkingAccess) {
    return (
      <AppShell>
        <div className="space-y-6 animate-augusto-fade-up">
          <Skeleton className="h-24 w-full" />
          <div className="grid lg:grid-cols-[1fr,300px] gap-8">
            <Skeleton className="h-[600px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !assembleia) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar assembleia.</p>
          <Button variant="outline" onClick={() => navigate({ to: "/app/assembleias" })} className="mt-4">
            Voltar para a lista
          </Button>
        </div>
      </AppShell>
    );
  }

  const editavel = ["rascunho", "convocada", "habilitacao_pendente"].includes(assembleia.situacao);

  return (
    <AppShell>
      <div className="max-w-6xl space-y-8 animate-augusto-fade-up">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/app/assembleias" })}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-serif text-primary tracking-tight">{assembleia.titulo}</h1>
                <AssembleiaSituacaoBadge situacao={assembleia.situacao} />
              </div>
              <p className="text-muted-foreground text-sm mt-1">{assembleia.tipo} • #{assembleia.codigo_publico}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              className="gap-2 border-augusto-gold/20 hover:bg-augusto-gold/5 text-augusto-gold"
              onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}/edital` as any })}
            >
              <FileText className="h-4 w-4" /> Edital
            </Button>
            
            <Button 
              variant="outline"
              className="gap-2 border-augusto-gold/20 hover:bg-augusto-gold/5 text-augusto-gold"
              onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}/convocacao` as any })}
            >
              <Send className="h-4 w-4" /> Convocação
            </Button>

            {editavel && (
              <Button 
                variant="augusto" 
                className="gap-2"
                onClick={() => navigate({ to: "/app/assembleias/nova" as any, search: { id: assembleia.id, step: 2 } as any })}
              >
                <Edit2 className="h-4 w-4" /> Editar pauta
              </Button>
            )}
          </div>
        </header>


        <div className="grid lg:grid-cols-[1fr,300px] gap-8 items-start">
          <main className="space-y-8">
            <Card className="p-6 border-augusto-gold/10 grid md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-augusto-gold">
                  <Calendar className="h-4 w-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Data e Hora</span>
                </div>
                <p className="text-sm font-medium">{format(new Date(assembleia.data_inicio), "PPP 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-augusto-gold">
                  <MapPin className="h-4 w-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Local</span>
                </div>
                <p className="text-sm font-medium">{assembleia.local || "Não informado"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-augusto-gold">
                  <Video className="h-4 w-4" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Modalidade</span>
                </div>
                <p className="text-sm font-medium capitalize">{assembleia.modalidade}</p>
                {assembleia.link_videoconferencia && (
                  <a href={assembleia.link_videoconferencia} target="_blank" className="text-[10px] text-augusto-gold hover:underline block truncate">
                    Acessar sala virtual
                  </a>
                )}
              </div>
            </Card>

            <section className="space-y-6">
              <h2 className="text-xl font-serif text-primary border-b border-augusto-gold/10 pb-2">Ordem do Dia</h2>
              <div className="space-y-4">
                {assembleia.itens.sort((a: any, b: any) => a.ordem - b.ordem).map((item: any) => (
                  <Card key={item.id} className="p-4 border-augusto-gold/5 bg-muted/20">
                    <div className="flex gap-4">
                      <NumeralRomano n={item.ordem} className="text-xl shrink-0" />
                      <div className="space-y-2 flex-1">
                        <h4 className="font-bold text-primary">{item.titulo}</h4>
                        {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground uppercase tracking-widest pt-2">
                          <span>{item.tipo_votacao === "sim_nao_abstencao" ? "Votação Padrão" : "Escolha Única"}</span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span>Quórum: {item.regra_quorum.replace(/_/g, " ")}</span>
                          {item.voto_secreto && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                              <span className="text-[#800020] font-bold">Voto Secreto</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
            {/* Painel de Controle de Votação (Provisório Fase 6) */}
            <Card className="mt-8 border-augusto-gold/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-[#00512B] text-lg">Controle de Votação</CardTitle>
                <CardDescription className="text-xs">Gerenciamento imediato da pauta para testes do portal.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assembleia.itens?.sort((a: any, b: any) => a.ordem - b.ordem).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-augusto-gold/5">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-augusto-gold font-bold uppercase">Item {item.ordem}</span>
                          <AssembleiaSituacaoBadge situacao={item.situacao} className="text-[9px] h-4" />
                        </div>
                        <h4 className="font-medium text-sm truncate">{item.titulo}</h4>
                      </div>
                      <div className="flex gap-2">
                        {item.situacao === 'pendente' && (
                          <Button 
                            size="sm" 
                            className="bg-[#00512B] h-8 text-xs"
                            onClick={async () => {
                              const { abrirVotacaoItem } = await import('@/lib/assembleias/votacao.functions');
                              toast.promise(abrirVotacaoItem({ data: { itemId: item.id } }), {
                                loading: 'Abrindo...',
                                success: () => {
                                  window.location.reload();
                                  return 'Votação aberta!';
                                },
                                error: 'Falha ao abrir.'
                              });
                            }}
                          >
                            Abrir
                          </Button>
                        )}
                        {item.situacao === 'aberto' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="h-8 text-xs"
                            onClick={async () => {
                              const { encerrarVotacaoItem } = await import('@/lib/assembleias/votacao.functions');
                              toast.promise(encerrarVotacaoItem({ data: { itemId: item.id } }), {
                                loading: 'Encerrando...',
                                success: () => {
                                  window.location.reload();
                                  return 'Votação encerrada!';
                                },
                                error: 'Falha ao encerrar.'
                              });
                            }}
                          >
                            Encerrar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>

          <aside className="space-y-6">
            <RevisaoIAPainel 
              alertas={assembleia.itens.filter((it: any) => it.alerta_ia).map((it: any) => ({
                ordem: it.ordem,
                nivel: it.alerta_ia.nivel,
                mensagem: it.alerta_ia.mensagem,
                fundamento_legal: it.fundamento_legal
              }))}
              onRevisar={() => navigate({ to: "/app/assembleias/nova" as any, search: { id: assembleia.id, step: 2 } as any })}
            />

            <Card className="p-4 border-augusto-gold/10">
               <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4">Regras Definidas</h4>
               <div className="space-y-3 text-xs">
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Base Padrão:</span>
                   <span className="font-medium text-primary capitalize">{assembleia.base_calculo_padrao?.replace(/_/g, " ")}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Bloqueio Inadimplentes:</span>
                   <span className="font-medium text-primary">{assembleia.bloqueio_inadimplente ? "Sim" : "Não"}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Limite Procurações:</span>
                   <span className="font-medium text-primary">{assembleia.limite_procuracoes || "Ilimitado"}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Voto pela Mesa:</span>
                   <span className="font-medium text-primary">{assembleia.voto_pela_mesa ? "Permitido" : "Negado"}</span>
                 </div>
               </div>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
