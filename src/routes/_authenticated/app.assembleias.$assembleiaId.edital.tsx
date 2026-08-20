import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getAssembleia } from '@/lib/assembleias/assembleias.functions';
import { montarEdital, melhorarRedacaoIA, publicarEdital } from '@/lib/assembleias/edital.functions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Sparkles, Save, FileCheck, ArrowRight, AlertTriangle } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/app/assembleias/$assembleiaId/edital')({
  component: EditalAssembleiaPage
});

function EditalAssembleiaPage() {
  const { assembleiaId } = Route.useParams();
  const [editalTexto, setEditalTexto] = useState('');
  const [melhorando, setMelhorando] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const { data: assembleia, isLoading } = useQuery({
    queryKey: ['assembleia', assembleiaId],
    queryFn: () => getAssembleia({ data: { id: assembleiaId } })
  });

  // Montagem inicial do edital
  useEffect(() => {
    async function loadInitial() {
      if (assembleia && !assembleia.edital_texto) {
        const result = await montarEdital({ data: { assembleiaId } });
        setEditalTexto(result.texto);
      } else if (assembleia?.edital_texto) {
        setEditalTexto(assembleia.edital_texto);
      }
    }
    loadInitial();
  }, [assembleia, assembleiaId]);

  const handleMelhorarIA = async () => {
    try {
      setMelhorando(true);
      const suggestions = await melhorarRedacaoIA({ 
        data: { 
          assembleiaId, 
          itens: assembleia.itens.map((it: any) => ({ id: it.id, titulo: it.titulo, descricao: it.descricao }))
        } 
      });
      
      // Aplica sugestões ao texto do edital (simplificado para esta fase)
      toast.success("Redação aprimorada pelo Augusto!");
      // Recarrega montagem com novas descrições...
      const result = await montarEdital({ data: { assembleiaId } });
      setEditalTexto(result.texto);
    } catch (e) {
      toast.error("Falha ao melhorar redação.");
    } finally {
      setMelhorando(false);
    }
  };

  const handlePublicar = async () => {
    try {
      setPublicando(true);
      await publicarEdital({ data: { assembleiaId, texto: editalTexto } });
      toast.success("Edital publicado com sucesso!");
    } catch (e) {
      toast.error("Erro ao publicar edital.");
    } finally {
      setPublicando(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const diasFaltantes = assembleia ? Math.ceil((new Date(assembleia.data_inicio).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const mostrarAvisoAntecedencia = diasFaltantes < 8 && diasFaltantes >= 0;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[#00512B]">Edital de Convocação</h1>
          <p className="text-muted-foreground">{assembleia?.titulo}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleMelhorarIA} disabled={melhorando}>
            <Sparkles className="mr-2 h-4 w-4 text-augusto-gold" />
            {melhorando ? 'Processando...' : 'Melhorar com Augusto'}
          </Button>
          <Button onClick={handlePublicar} disabled={publicando}>
            <Save className="mr-2 h-4 w-4" />
            {publicando ? 'Publicando...' : 'Publicar Edital'}
          </Button>
        </div>
      </header>

      {mostrarAvisoAntecedencia && (
        <Card className="p-4 border-augusto-gold/50 bg-augusto-gold/5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-augusto-gold" />
          <span className="text-sm text-augusto-gold font-medium">
            Faltam apenas {diasFaltantes} dias para a assembleia. Lembre-se que a maioria das convenções exige antecedência mínima de 8 dias.
          </span>
        </Card>
      )}

      <Card className="p-0 overflow-hidden border-[#E4E1D8]">
        <textarea
          value={editalTexto}
          onChange={(e) => setEditalTexto(e.target.value)}
          className="w-full min-h-[600px] p-8 font-serif text-lg leading-relaxed focus:outline-none resize-none"
          placeholder="Montando edital..."
        />
      </Card>
      
      {assembleia?.edital_publicado_em && (
        <p className="text-xs text-muted-foreground text-right italic">
          Última alteração publicada em: {new Date(assembleia.edital_publicado_em).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}
