import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';
import { solicitarAcessoVotacao, confirmarAcessoVotacao } from '@/lib/assembleias/votante.functions';
import { getEstadoVotacao, registrarVoto, conferirRecibo } from '@/lib/assembleias/votacao.portal.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Clock, ChevronRight, Hash } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/v/$codigo')({
  component: VotacaoPortalPage
});

function VotacaoPortalPage() {
  const { codigo } = Route.useParams();
  const [step, setStep] = useState<'email' | 'otp' | 'votacao' | 'bloqueado'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [votosRealizados, setVotosRealizados] = useState<Record<string, string>>({});

  const fetchEstado = useServerFn(getEstadoVotacao);
  const fnSolicitar = useServerFn(solicitarAcessoVotacao);
  const fnConfirmar = useServerFn(confirmarAcessoVotacao);
  const fnVotar = useServerFn(registrarVoto);

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fnSolicitar({ data: { codigo, email } });
      setStep('otp');
      toast.success("Código enviado para seu e-mail.");
    } catch (err: any) {
      toast.error("Falha ao solicitar acesso.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fnConfirmar({ data: { codigo, email, otp } });
      if (res.success && res.token) {
        setSessionToken(res.token);
        setStep('votacao');
      } else {
        toast.error(res.error || "Código inválido.");
      }
    } catch (err: any) {
      toast.error("Falha na validação.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <div className="min-h-screen bg-[#F4F3F2] flex flex-col items-center py-12 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-[#00512B] p-8 rounded-t-lg text-center">
            <img src="https://augustoij.com.br/__l5e/assets-v1/598c4b3d-6b9f-4b5a-a484-6e195d698b48/augusto-ij-logo-full-dark-FINAL.png" 
                 alt="Augusto.IJ" className="h-10 mx-auto mb-4" />
            <h1 className="font-serif text-white text-xl">Portal de Votação</h1>
          </div>
          
          <Card className="rounded-t-none border-t-0">
            <CardHeader>
              <CardTitle className="font-serif text-2xl text-[#00512B]">Identificação</CardTitle>
              <CardDescription>
                Informe o e-mail cadastrado em sua unidade para receber o código de acesso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSolicitar} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    type="email" 
                    placeholder="seu@email.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 text-lg"
                  />
                </div>
                <Button type="submit" className="w-full h-14 bg-[#00512B] hover:bg-[#004022] text-lg font-medium" disabled={loading}>
                  {loading ? "Processando..." : "Receber Código"}
                </Button>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Caso não receba o código em instantes, procure o síndico ou a administração.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-[#F4F3F2] flex flex-col items-center py-12 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-[#00512B] p-8 rounded-t-lg text-center text-white">
            <Hash className="w-12 h-12 mx-auto mb-2 text-[#B8935A]" />
            <h1 className="font-serif text-xl">Validação de Acesso</h1>
          </div>
          <Card className="rounded-t-none border-t-0">
            <CardHeader>
              <CardTitle className="font-serif text-2xl text-[#00512B]">Digite o código</CardTitle>
              <CardDescription>
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfirmar} className="space-y-4">
                <Input 
                  type="text" 
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="h-14 text-3xl tracking-[0.5em] text-center font-mono"
                  required
                />
                <Button type="submit" className="w-full h-14 bg-[#00512B] hover:bg-[#004022] text-lg font-medium" disabled={loading}>
                  Entrar na Assembleia
                </Button>
                <Button variant="ghost" onClick={() => setStep('email')} className="w-full">
                  Voltar e corrigir e-mail
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3F2] flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-lg border border-[#E4E1D8]">
          <div className="font-serif text-[#00512B] text-lg">Votação em Andamento</div>
          <div className="bg-[#B8935A] text-white px-3 py-1 rounded text-sm font-bold uppercase tracking-widest">Ao Vivo</div>
        </header>

        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Clock className="w-12 h-12 mx-auto text-[#B8935A] animate-pulse" />
            <h2 className="font-serif text-2xl text-[#00512B]">Aguardando abertura de item</h2>
            <p className="text-muted-foreground">A mesa diretora está preparando o próximo ponto da pauta. Mantenha esta tela aberta.</p>
          </CardContent>
        </Card>

        <ConferirRecibo codigo={codigo} />
      </div>
    </div>
  );
}

function ConferirRecibo({ codigo }: { codigo: string }) {
  const fnConferir = useServerFn(conferirRecibo);
  const [recibo, setRecibo] = useState("");
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  const handleConferir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recibo.trim()) return;
    setCarregando(true);
    setResultado(null);
    try {
      const r = await fnConferir({ data: { codigo, recibo: recibo.trim() } });
      setResultado(r);
    } catch {
      toast.error("Não foi possível conferir agora. Tente novamente em instantes.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl text-[#00512B]">Conferir meu recibo</CardTitle>
        <CardDescription>
          Cole o código do recibo recebido ao votar. A conferência mostra o item e a opção computada, sem revelar
          qualquer informação de unidade. Só responde para itens já encerrados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleConferir} className="flex flex-col sm:flex-row gap-2">
          <Input
            value={recibo}
            onChange={(e) => setRecibo(e.target.value)}
            placeholder="Código do recibo"
            className="font-mono"
            aria-label="Código do recibo"
          />
          <Button type="submit" disabled={carregando} className="bg-[#00512B] hover:bg-[#004022]">
            Conferir
          </Button>
        </form>

        {resultado && resultado.encontrado && (
          <div className="rounded-md border border-[#E4E1D8] bg-white p-4 text-sm">
            <p className="flex items-center gap-2 text-[#00512B] font-medium">
              <CheckCircle2 className="w-4 h-4" /> Recibo localizado
            </p>
            <p className="mt-2">Item {resultado.item.ordem} — {resultado.item.titulo}</p>
            <p className="text-muted-foreground">Opção computada: <strong>{resultado.opcao}</strong></p>
            {resultado.anulado && <p className="text-destructive text-xs mt-1">Item anulado pela mesa.</p>}
          </div>
        )}

        {resultado && !resultado.encontrado && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            Código não corresponde a nenhum voto encerrado desta assembleia.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
