import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getStatusAssinaturaAtual } from "@/lib/asaas.functions";

export const Route = createFileRoute("/_authenticated/app/assinatura/retorno")({
  component: RetornoPage,
});

function RetornoPage() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getStatusAssinaturaAtual);
  const [tentativas, setTentativas] = useState(0);

  const status = useQuery({
    queryKey: ["status-assinatura-atual"],
    queryFn: () => getStatus(),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && d.status === "active" && d.plano_config_id && d.plano_config_id !== "gratuito") {
        return false;
      }
      return 2000;
    },
  });

  useEffect(() => {
    if (!status.data) return;
    setTentativas((t) => t + 1);
    const ativo =
      status.data.status === "active" &&
      status.data.plano_config_id &&
      status.data.plano_config_id !== "gratuito";
    if (ativo) {
      toast.success("Plano ativado! Bem-vindo(a) ao Augusto.IJ.");
      const destino = status.data.tem_condominio ? "/app" : "/app/condominios";
      window.setTimeout(() => navigate({ to: destino }), 1200);
    }
  }, [status.data, navigate]);

  const ativo =
    status.data?.status === "active" &&
    status.data?.plano_config_id &&
    status.data.plano_config_id !== "gratuito";
  const esgotou = tentativas > 10 && !ativo;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <AugustoLogo variant="stacked" theme="light" size={200} showTagline />
      </div>
      <div className="w-full max-w-[460px] rounded-xl border border-border bg-card text-card-foreground p-10 shadow-sm text-center">
        {ativo ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Pagamento confirmado!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu plano <span className="font-medium text-foreground">{status.data?.plano_config_id}</span>{" "}
              está ativo. Redirecionando…
            </p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-semibold">Confirmando seu pagamento…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos aguardando a confirmação do Asaas. Isso pode levar alguns
              segundos para Pix e alguns minutos para outras formas.
            </p>
            {esgotou && (
              <div className="mt-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  A confirmação está demorando mais que o esperado. Você já pode
                  seguir usando o painel — assim que o pagamento for confirmado,
                  seu plano é liberado automaticamente.
                </p>
                <Button className="w-full" onClick={() => navigate({ to: "/app" })}>
                  Ir para o painel
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RetornoPage;