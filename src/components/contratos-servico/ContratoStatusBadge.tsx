import { Badge } from "@/components/ui/badge";
import { rotuloStatus, type StatusExibicaoContrato } from "@/lib/contratos-servico/status";

export function ContratoStatusBadge({ status }: { status: StatusExibicaoContrato }) {
  const classes: Record<StatusExibicaoContrato, string> = {
    vigente: "bg-[color-mix(in_hsl,var(--augusto-green)_12%,transparent)] text-augusto-green border-augusto-green/25",
    vence_em_breve: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100",
    vencido: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
    suspenso: "bg-muted text-muted-foreground border-[var(--landing-rule)]",
    encerrado: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={classes[status]}>
      {rotuloStatus(status)}
    </Badge>
  );
}