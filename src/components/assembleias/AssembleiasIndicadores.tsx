import React from "react";
import { Card } from "@/components/ui/card";
import { Users, Calendar, FileText, CheckCircle2 } from "lucide-react";

interface IndicadorProps {
  label: string;
  value: string | number;
  note: string;
  icon: React.ElementType;
}

function Indicador({ label, value, note, icon: Icon }: IndicadorProps) {
  return (
    <Card className="p-4 border-augusto-gold/10 bg-augusto-gold/[0.02] flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg bg-augusto-gold/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-augusto-gold" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-serif text-primary">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
      </div>
    </Card>
  );
}

export function AssembleiasIndicadores({ 
  emAndamento, 
  proximaEmDias 
}: { 
  emAndamento: number; 
  proximaEmDias: number | null 
}) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Indicador 
        label="Em andamento" 
        value={emAndamento} 
        note={emAndamento === 1 ? "Assembleia corrente" : `${emAndamento} assembleias correntes`}
        icon={Users}
      />
      <Indicador 
        label="Convocadas" 
        value={proximaEmDias !== null ? proximaEmDias : "—"} 
        note={proximaEmDias !== null ? `Dias para a próxima` : "Nenhuma convocada"}
        icon={Calendar}
      />
      <Indicador 
        label="Atas pendentes" 
        value="—" 
        note="Disponível após habilitação"
        icon={FileText}
      />
      <Indicador 
        label="Unidades aptas" 
        value="—" 
        note="Total de unidades e inadimplência"
        icon={CheckCircle2}
      />
    </div>
  );
}
