import { createFileRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  Search,
  Filter,
  CheckCircle,
  User,
  Vote,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { getAssembleia } from "@/lib/assembleias/assembleias.functions";
import { registrarVotoMesa } from "@/lib/assembleias/mesa.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

const searchSchema = z.object({
  itemId: z.string().uuid()
});

export const Route = createFileRoute("/_authenticated/app/assembleias/$assembleiaId/mesa/voto-manual")({
  component: VotoManualPage,
  validateSearch: (search) => searchSchema.parse(search)
});

function VotoManualPage() {
  const { assembleiaId } = useParams({ from: "/_authenticated/app/assembleias/$assembleiaId/mesa/voto-manual" }) as any;
  const { itemId } = useSearch({ from: "/_authenticated/app/assembleias/$assembleiaId/mesa/voto-manual" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchAssembleia = useServerFn(getAssembleia);
  const registrarVoto = useServerFn(registrarVotoMesa);

  const [busca, setBusca] = useState("");
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any>(null);
  const [opcaoSelecionadaId, setOpcaoSelecionadaId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const { data: assembleia, isLoading } = useQuery({
    queryKey: ["assembleia-voto-manual", assembleiaId],
    queryFn: () => fetchAssembleia({ data: { id: assembleiaId } })
  });

  const item = assembleia?.itens.find((it: any) => it.id === itemId);

  const { data: unidadesAptas, isLoading: buscandoUnidades } = useQuery({
    queryKey: ["unidades-aptas-voto", assembleiaId, itemId],
    queryFn: async () => {
      // Buscar unidades habilitadas que ainda não votaram
      const { data: habs } = await supabase
        .from("assembleia_habilitacoes")
        .select("*, unidades(bloco, numero)")
        .eq("assembleia_id", assembleiaId)
        .eq("apta", true);

      const { data: votos } = await supabase
        .from("assembleia_votos")
        .select("unidade_id")
        .eq("item_id", itemId)
        .is("invalidado_em", null);

      const jaVotaramIds = new Set(votos?.map(v => v.unidade_id));
      
      return habs?.filter(h => !jaVotaramIds.has(h.unidade_id)) || [];
    },
    enabled: !!item
  });

  const filtradas = unidadesAptas?.filter((h: any) => {
    const termo = busca.toLowerCase();
    return h.unidades.bloco?.toLowerCase().includes(termo) || 
           h.unidades.numero?.toLowerCase().includes(termo);
  });

  const mutation = useMutation({
    mutationFn: registrarVoto,
    onSuccess: () => {
      toast.success("Voto nominal registrado!");
      navigate({ to: `/app/assembleias/${assembleiaId}/mesa` as any });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar voto.");
    }
  });

  const handleConfirmar = () => {
    if (!unidadeSelecionada || !opcaoSelecionadaId || justificativa.length < 10) return;

    mutation.mutate({
      data: {
        itemId,
        unidadeId: unidadeSelecionada.unidade_id,
        opcaoId: opcaoSelecionadaId,
        justificativa
      }
    });
  };

  if (isLoading || buscandoUnidades) return <AppShell><Skeleton className="h-screen w-full" /></AppShell>;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 animate-augusto-fade-up pb-12">
        <header className="flex items-center gap-4 border-b border-augusto-gold/10 pb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: `/app/assembleias/${assembleiaId}/mesa` as any })}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif text-primary">Lançamento de Voto Nominal</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Item: {item?.titulo}</p>
          </div>
        </header>

        {!unidadeSelecionada ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">1. Selecione a Unidade</CardTitle>
                <CardDescription>Busque na lista de unidades habilitadas que ainda não votaram.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrar por bloco ou número..." 
                    className="pl-10"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {filtradas?.map((h: any) => (
                    <Button
                      key={h.unidade_id}
                      variant="outline"
                      className="h-auto py-4 px-6 justify-start text-left border-augusto-gold/10 hover:border-augusto-gold/40 hover:bg-augusto-gold/5"
                      onClick={() => setUnidadeSelecionada(h)}
                    >
                      <User className="h-4 w-4 mr-3 text-augusto-gold" />
                      <div>
                        <span className="block font-bold">Unidade {h.unidades.bloco}-{h.unidades.numero}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">Peso: {h.peso_unidade}</span>
                      </div>
                    </Button>
                  ))}
                  {filtradas?.length === 0 && (
                    <div className="col-span-2 py-12 text-center text-muted-foreground italic border-dashed border-2 rounded-lg">
                      Nenhuma unidade encontrada ou todas já votaram.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-augusto-gold/30 bg-augusto-gold/5">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-augusto-gold/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-augusto-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg">Unidade {unidadeSelecionada.unidades.bloco}-{unidadeSelecionada.unidades.numero}</h3>
                    <p className="text-xs text-muted-foreground uppercase">Pronta para lançamento de voto</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => { setUnidadeSelecionada(null); setOpcaoSelecionadaId(""); }}>Trocar Unidade</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif">2. Detalhes do Voto</CardTitle>
                <CardDescription>O voto nominal será registrado publicamente em ata vinculada à unidade.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Opção de Voto</Label>
                  <Select value={opcaoSelecionadaId} onValueChange={setOpcaoSelecionadaId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Selecione a opção manifestada..." />
                    </SelectTrigger>
                    <SelectContent>
                      {item?.assembleia_opcoes?.map((op: any) => (
                        <SelectItem key={op.id} value={op.id}>{op.rotulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="justificativa">Justificativa da Mesa (Obrigatório)</Label>
                  <Textarea 
                    id="justificativa"
                    placeholder="Ex: Manifestação verbal em plenário confirmada pelo presidente..."
                    className="min-h-[100px]"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Mínimo 10 caracteres para auditoria.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    <strong>Atenção:</strong> Lançamentos manuais são auditáveis e ficam registrados com o seu usuário como responsável. 
                    Certifique-se de que a unidade manifestou o voto de forma clara antes de prosseguir.
                  </p>
                </div>
              </CardContent>
              <CardContent className="border-t border-augusto-gold/5 p-6 flex justify-end">
                <Button 
                  size="lg" 
                  className="bg-augusto-gold hover:bg-augusto-gold/90 text-white min-w-[200px] gap-2"
                  disabled={!opcaoSelecionadaId || justificativa.length < 10 || mutation.isPending}
                  onClick={handleConfirmar}
                >
                  Confirmar Voto <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
