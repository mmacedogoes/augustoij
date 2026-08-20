import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AssembleiaSituacao = 
  | "rascunho"
  | "convocada"
  | "habilitacao_aberta"
  | "habilitacao_pendente"
  | "ao_vivo"
  | "em_votacao"
  | "votos_encerrados"
  | "finalizada"
  | "encerrada"
  | "ata_pendente"
  | "ata_publicada"
  | "cancelada";

interface AssembleiaSituacaoBadgeProps {
  situacao: AssembleiaSituacao;
  className?: string;
}

export function AssembleiaSituacaoBadge({ situacao, className }: AssembleiaSituacaoBadgeProps) {
  const configs: Record<AssembleiaSituacao, { label: string; className: string; dot?: boolean }> = {
    rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground border-transparent" },
    convocada: { label: "Convocada", className: "bg-augusto-gold/10 text-augusto-gold border-augusto-gold/20" },
    habilitacao_aberta: { label: "Habilitação aberta", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    habilitacao_pendente: { label: "Pendência de Habilitação", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    ao_vivo: { label: "Ao vivo", className: "bg-[#800020] text-white border-transparent", dot: true },
    em_votacao: { label: "Em votação", className: "bg-[#800020] text-white border-transparent", dot: true },
    votos_encerrados: { label: "Votos encerrados", className: "bg-augusto-gold/10 text-augusto-gold border-augusto-gold/20" },
    finalizada: { label: "Finalizada", className: "bg-augusto-green/10 text-augusto-green border-augusto-green/20" },
    encerrada: { label: "Encerrada", className: "bg-augusto-green/10 text-augusto-green border-augusto-green/20" },
    ata_pendente: { label: "Ata pendente", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    ata_publicada: { label: "Ata publicada", className: "bg-augusto-green/10 text-augusto-green border-augusto-green/20" },
    cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground border-transparent" },
  };

  const config = configs[situacao] || configs.rascunho;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium px-2 py-0.5 flex items-center gap-1.5 w-fit", 
        config.className,
        className
      )}
    >
      {config.dot && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
      {config.label}
    </Badge>
  );
}
