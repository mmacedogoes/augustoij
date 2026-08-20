import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, Sparkles, Check } from "lucide-react";
import { PassoDados } from "@/components/assembleias/PassoDados";
import { PassoPauta, ItemPauta } from "@/components/assembleias/PassoPauta";
import { PassoRegras } from "@/components/assembleias/PassoRegras";
import { RevisaoIAPainel } from "@/components/assembleias/RevisaoIAPainel";
import { createAssembleia, getAssembleia } from "@/lib/assembleias/assembleias.functions";
import { upsertItemPauta, reordenarItens } from "@/lib/assembleias/pauta.functions";
import { revisarPautaIA } from "@/lib/assembleias/revisao-ia.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isSuperAdmin } from "@/lib/contratos-servico/guard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/assembleias/nova")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/app/assembleias/nova" }) as any;
  const initialStep = parseInt(search.step as string) || 1;
  const assembleiaId = search.id as string | undefined;

  const [step, setStep] = useState(initialStep);
  const [condominioId, setCondominioId] = useState<string | null>(null);

  const [dados, setDados] = useState({
    titulo: "",
    tipo: "AGO",
    data_inicio: "",
    local: "",
    modalidade: "presencial" as const,
    link_videoconferencia: "",
    convocacao_numero: 1,
  });

  const [itens, setItens] = useState<ItemPauta[]>([]);
  const [regras, setRegras] = useState({
    base_calculo_padrao: "voto_por_unidade",
    quorum_instalacao_1: "maioria_unidades",
    quorum_instalacao_2: null as string | null,
    bloqueio_inadimplente: true,
    limite_procuracoes: null as number | null,
    voto_pela_mesa: false,
  });

  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const [unidadesSemFracao, setUnidadesSemFracao] = useState(0);

  const fetchAssembleia = useServerFn(getAssembleia);
  const saveAssembleia = useServerFn(createAssembleia);
  const saveItem = useServerFn(upsertItemPauta);
  const sortItens = useServerFn(reordenarItens);
  const runIa = useServerFn(revisarPautaIA);

  // Acesso e condomínio ativo
  useEffect(() => {
    const cid = localStorage.getItem("augusto.condominioAtivo");
    if (cid) setCondominioId(cid);
    
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const isSuper = await isSuperAdmin({ supabase, userId: user.id });
      if (!isSuper) {
        toast.error("Acesso restrito.");
        navigate({ to: "/app" });
      }
    };
    checkAccess();
  }, [navigate]);

  // Carregar dados se for edição
  useQuery({
    queryKey: ["assembleia-edit", assembleiaId],
    queryFn: async () => {
      if (!assembleiaId) return null;
      const data = await fetchAssembleia({ data: { id: assembleiaId } });
      setDados({
        titulo: data.titulo,
        tipo: data.tipo,
        data_inicio: new Date(data.data_inicio).toISOString().slice(0, 16),
        local: data.local || "",
        modalidade: data.modalidade as any,
        link_videoconferencia: data.link_videoconferencia || "",
        convocacao_numero: data.convocacao_numero,
      });
      setItens(data.itens.map((it: any) => ({
        ...it,
        alerta_ia: it.alerta_ia ? JSON.parse(JSON.stringify(it.alerta_ia)) : undefined
      })));
      return data;
    },
    enabled: !!assembleiaId
  });

  // Checar frações ideais
  useEffect(() => {
    if (!condominioId) return;
    const fetchFracoes = async () => {
      const { count } = await supabase
        .from("unidades")
        .select("*", { count: "exact", head: true })
        .eq("condominio_id", condominioId)
        .is("fracao_ideal", null);
      setUnidadesSemFracao(count || 0);
    };
    fetchFracoes();
  }, [condominioId]);

  const handleNext = async () => {
    if (step === 1) {
      if (dados.titulo.length < 5) { toast.error("Título muito curto."); return; }
      if (!dados.data_inicio) { toast.error("Selecione data e hora."); return; }
      
      try {
        if (!assembleiaId && condominioId) {
          const res = await saveAssembleia({
            data: { ...dados, condominio_id: condominioId }
          });
          navigate({ to: "/app/assembleias/nova" as any, search: { id: res.id, step: 2 } as any });
        }
        setStep(2);
      } catch (e: any) {
        toast.error(e.message);
      }
    } else if (step === 2) {
      if (itens.length === 0) { toast.error("Adicione ao menos um item à pauta."); return; }
      
      // Auto-revisão se for a primeira vez concluindo a pauta
      if (!itens.some(it => it.alerta_ia) && assembleiaId) {
        handleIaRevisao();
      }
      setStep(3);
    }
  };

  const handleIaRevisao = async () => {
    if (!assembleiaId) return;
    setIaLoading(true);
    setIaError(null);
    try {
      const res = await runIa({ data: { assembleiaId } });
      // Recarregar itens para mostrar alertas
      const updated = await fetchAssembleia({ data: { id: assembleiaId } });
      setItens(updated.itens);
      toast.success("IA revisou a pauta com sucesso.");
    } catch (e: any) {
      setIaError(e.message);
      toast.error("IA indisponível temporariamente.");
    } finally {
      setIaLoading(false);
    }
  };

  const steps = [
    { n: 1, label: "Dados" },
    { n: 2, label: "Pauta e quóruns" },
    { n: 3, label: "Regras da votação" },
    { n: 4, label: "Edital e convite", disabled: true }
  ];

  return (
    <AppShell>
      <div className="max-w-6xl space-y-8 animate-augusto-fade-up">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/app/assembleias" })}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-serif text-primary">Nova Assembleia</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Passo {step} de 3</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {steps.map(s => (
              <div key={s.n} className="flex items-center">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === s.n ? "bg-augusto-gold text-white" : 
                  step > s.n ? "bg-augusto-green text-white" : "bg-muted text-muted-foreground opacity-50",
                  s.disabled && "opacity-20"
                )}>
                  {step > s.n ? <Check className="h-4 w-4" /> : s.n}
                </div>
                {s.n < 4 && <div className="w-8 h-px bg-muted mx-1" />}
              </div>
            ))}
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr,300px] gap-8 items-start">
          <main className="space-y-8">
            {step === 1 && <PassoDados data={dados} onChange={setDados} />}
            {step === 2 && <PassoPauta itens={itens} onChange={setItens} regrasPadrao={regras} />}
            {step === 3 && <PassoRegras data={regras} onChange={setRegras} unidadesSemFracao={unidadesSemFracao} />}
            
            <div className="flex items-center justify-between border-t pt-8">
              <Button variant="ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
              <Button variant="augusto" onClick={step === 3 ? () => navigate({ to: "/app/assembleias" }) : handleNext} className="gap-2">
                {step === 3 ? <><Save className="h-4 w-4" /> Salvar assembleia</> : <>Próximo passo <ChevronRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </main>

          <aside className="space-y-6">
             {step >= 2 && (
               <RevisaoIAPainel 
                 loading={iaLoading}
                 error={iaError}
                 alertas={itens.filter(it => it.alerta_ia).map(it => ({
                   ordem: it.ordem,
                   nivel: it.alerta_ia!.nivel as any,
                   mensagem: it.alerta_ia!.mensagem,
                   fundamento_legal: it.fundamento_legal
                 }))}
                 onRevisar={handleIaRevisao}
               />
             )}
             
             <Card className="p-4 border-augusto-gold/10 bg-muted/30">
               <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-4">Regras da assembleia</h4>
               <div className="space-y-3 text-xs">
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Base Padrão:</span>
                   <span className="font-medium text-primary">{regras.base_calculo_padrao === "voto_por_unidade" ? "Unidade" : "Fração"}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Inadimplentes:</span>
                   <span className="font-medium text-primary">{regras.bloqueio_inadimplente ? "Bloqueados" : "Liberados"}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-muted-foreground">Procurações:</span>
                   <span className="font-medium text-primary">{regras.limite_procuracoes || "Sem limite"}</span>
                 </div>
               </div>
             </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
