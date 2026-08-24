import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { validarTokenCabine, registrarVotoCabine } from "@/lib/assembleias/cabine.functions";
import { ShieldCheck, Loader2, CheckCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/cabine/$token")({
  component: CabinePage,
});

function CabinePage() {
  const { token } = useParams({ from: "/cabine/$token" }) as any;
  const navigate = useNavigate();
  const [valido, setValido] = useState<boolean | null>(null);
  const [item, setItem] = useState<any>(null);
  const [, setUnidadeId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const validarFn = useServerFn(validarTokenCabine);

  // 1. Validar token e buscar item (via função de servidor pública)
  const { isLoading: validando } = useQuery({
    queryKey: ["cabine-token", token],
    queryFn: async () => {
      try {
        const res = await validarFn({ data: { token } });
        if (!res.valido) {
          setValido(false);
          return null;
        }
        setValido(true);
        setItem(res.item);
        setUnidadeId(res.unidadeId);
        return res;
      } catch {
        setValido(false);
        return null;
      }
    },
    retry: false
  });

  const registerVotoFn = useServerFn(registrarVotoCabine);

  const mutation = useMutation({
    mutationFn: registerVotoFn,
    onSuccess: async () => {
      toast.success("Voto registrado com sucesso!");
      setTimeout(() => navigate({ to: "/" }), 3000);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar voto.");
    }
  });

  if (validando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 text-augusto-gold animate-spin" />
      </div>
    );
  }

  if (valido === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center p-8">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <CardHeader>
            <CardTitle className="font-serif">Token Inválido ou Expirado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Este acesso não é mais válido. Por favor, solicite um novo acesso à mesa diretora.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/" })} className="w-full">
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#00512B] text-white p-4">
        <div className="text-center animate-augusto-fade-up">
          <CheckCircle className="h-20 w-20 mx-auto mb-6" />
          <h1 className="text-4xl font-serif mb-2">Voto Confirmado</h1>
          <p className="text-white/70">Obrigado pela sua participação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-serif text-primary tracking-tight">Cabine de Votação</h1>
        <p className="text-sm text-muted-foreground mt-1">Ambiente seguro e privativo</p>
      </header>

      <Card className="max-w-2xl w-full border-augusto-gold/20 shadow-xl overflow-hidden">
        <div className="bg-[#00512B] p-6 text-white">
          <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-70">Item em Votação</span>
          <h2 className="text-xl font-serif mt-1">{item?.titulo}</h2>
        </div>

        <CardContent className="p-8">
          <div className="grid gap-4">
            {item?.opcoes?.map((opcao: any) => (
              <Button
                key={opcao.id}
                variant="outline"
                className="h-20 text-lg border-2 hover:border-augusto-gold hover:bg-augusto-gold/5 justify-start px-8 group transition-all"
                disabled={mutation.isPending}
                onClick={() => {
                  if (item) {
                    mutation.mutate({ data: { token, opcaoId: opcao.id } });
                  }
                }}
              >
                <div className="flex-1 text-left">
                  <span className="block font-serif text-primary group-hover:text-augusto-gold">{opcao.rotulo}</span>
                  {opcao.descricao && <span className="block text-xs text-muted-foreground font-normal">{opcao.descricao}</span>}
                </div>
                <div className="h-6 w-6 rounded-full border-2 border-muted group-hover:border-augusto-gold flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-augusto-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Button>
            ))}
          </div>

          <div className="mt-12 flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <ShieldCheck className="h-3 w-3" />
            <span>Sua identidade é preservada através de criptografia e voto secreto.</span>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-8">
         <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Augusto · Inteligência Jurídica</p>
      </footer>
    </div>
  );
}
