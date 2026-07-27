import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanContext } from "@/hooks/usePlanContext";

/**
 * Overlay/cadeado da Gestão Contínua de Contratos.
 * - Gratuito: bloqueia todo o módulo (aviso em cartão âmbar, sem quebrar layout).
 * - Painel consolidado exige plano Gestão+.
 */
export function GestaoContratosGate({
  requerePainelConsolidado = false,
  children,
}: {
  requerePainelConsolidado?: boolean;
  children: ReactNode;
}) {
  const { data, isLoading } = usePlanContext();
  if (isLoading || !data) return <>{children}</>;

  const bloqueadoGratuito =
    !data.cortesia && (data.contratosGestaoAtivaMax === 0 || data.planoId === "gratuito");
  const bloqueadoPainel = requerePainelConsolidado && !data.painelConsolidado;

  if (!bloqueadoGratuito && !bloqueadoPainel) return <>{children}</>;

  const titulo = bloqueadoGratuito
    ? "Gestão contínua de contratos"
    : "Painel consolidado da carteira";
  const descricao = bloqueadoGratuito
    ? "A agenda, os checklists e os alertas mês a mês são acionados automaticamente para cada contrato. Disponível a partir do plano Essencial."
    : "A visão consolidada dos contratos de todos os condomínios da sua carteira está disponível a partir do plano Gestão.";

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-8 sm:pt-16">
        <div className="max-w-lg w-[min(92%,32rem)] rounded-lg border-l-4 border-primary bg-[hsl(var(--card))] shadow-lg p-6 space-y-3"
             style={{ background: "hsl(43 60% 96%)" }}>
          <div className="flex items-center gap-2 text-foreground">
            <span className="grid place-items-center h-9 w-9 rounded-md bg-primary/10 text-primary">
              <Lock className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <p className="font-semibold leading-tight">{titulo}</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/app/conta">
              <Sparkles className="h-3.5 w-3.5" /> Ver planos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}