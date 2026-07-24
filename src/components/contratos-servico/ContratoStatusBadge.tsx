import { Badge } from "@/components/ui/badge";
import { rotuloStatus, type StatusExibicaoContrato } from "@/lib/contratos-servico/status";

export function ContratoStatusBadge({ status }: { status: StatusExibicaoContrato }) {
  const classes: Record<StatusExibicaoContrato, string> = {
    vigente: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100",
    vence_em_breve: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100",
    vencido: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100",
    suspenso: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100",
    encerrado: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={classes[status]}>
      {rotuloStatus(status)}
    </Badge>
  );
}