import { cn } from "@/lib/utils";
import type { UsoAtual } from "@/lib/uso-limits";

/**
 * Rodapé discreto abaixo do input do chat mostrando consumo do usuário.
 * - Planos com limite mensal: "X de Y mensagens usadas este mês"
 * - Plano Gratuito: "X de 10 mensagens usadas hoje · Plano expira em N dias"
 * - Planos ilimitados: renderiza null (não cria ansiedade)
 */
export function UsageFooter({ uso }: { uso: UsoAtual }) {
  const { planoId, mensagensDia, mensagensMes, limiteDia, limiteMes, diasRestantesTrial } = uso;

  if (planoId === "gratuito" && limiteDia !== null) {
    const restantesDia = Math.max(0, limiteDia - mensagensDia);
    const pct = Math.min(100, (mensagensDia / limiteDia) * 100);
    const nearLimit = restantesDia <= 2;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-1 w-6 rounded-full bg-muted overflow-hidden",
              "relative",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                nearLimit ? "bg-destructive" : "bg-primary/70",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className={cn("font-medium tabular-nums", nearLimit && "text-destructive")}>
            {mensagensDia}/{limiteDia}
          </span>
          mensagens usadas hoje
        </span>
        {diasRestantesTrial !== null && (
          <>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span>
              Plano expira em{" "}
              <span className="font-medium tabular-nums">
                {diasRestantesTrial} {diasRestantesTrial === 1 ? "dia" : "dias"}
              </span>
            </span>
          </>
        )}
      </div>
    );
  }

  if (limiteMes !== null) {
    const restantes = Math.max(0, limiteMes - mensagensMes);
    const pct = Math.min(100, (mensagensMes / limiteMes) * 100);
    const nearLimit = restantes <= Math.max(5, Math.floor(limiteMes * 0.1));
    return (
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="relative inline-block h-1 w-8 rounded-full bg-muted overflow-hidden">
          <span
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
              nearLimit ? "bg-destructive" : "bg-primary/70",
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={cn("font-medium tabular-nums", nearLimit && "text-destructive")}>
          {mensagensMes}
        </span>
        de <span className="tabular-nums">{limiteMes}</span> mensagens usadas este mês
      </p>
    );
  }

  // Ilimitado — nada a mostrar
  return null;
}

export default UsageFooter;