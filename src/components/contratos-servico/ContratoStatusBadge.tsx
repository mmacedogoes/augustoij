import { Badge } from "@/components/ui/badge";
import { rotuloStatus, type StatusExibicaoContrato } from "@/lib/contratos-servico/status";
import { cn } from "@/lib/utils";

export function ContratoStatusBadge({
  status,
  className,
}: {
  status: StatusExibicaoContrato;
  className?: string;
}) {
  const configs: Record<
    StatusExibicaoContrato,
    { badge: string; dot: string }
  > = {
    vigente: {
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium",
      dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]",
    },
    vence_em_breve: {
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium",
      dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
    },
    vencido: {
      badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-medium",
      dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]",
    },
    suspenso: {
      badge: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30 font-medium",
      dot: "bg-slate-400",
    },
    encerrado: {
      badge: "bg-muted text-muted-foreground border-border font-normal",
      dot: "bg-muted-foreground/60",
    },
  };

  const current = configs[status] ?? configs.encerrado;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs transition-colors rounded-full",
        current.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", current.dot)} />
      {rotuloStatus(status)}
    </Badge>
  );
}