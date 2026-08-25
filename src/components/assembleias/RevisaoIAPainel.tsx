import React from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlertaIA {
  ordem: number;
  nivel: "info" | "atencao" | "risco";
  mensagem: string;
  fundamento_legal?: string;
  quorum_sugerido?: string;
}

interface RevisaoIAPainelProps {
  loading?: boolean;
  alertas: AlertaIA[];
  onRevisar: () => void;
  onAplicarSugestao?: (alerta: AlertaIA) => void;
  error?: string | null;
}

export function RevisaoIAPainel({ 
  loading, 
  alertas, 
  onRevisar, 
  onAplicarSugestao,
  error 
}: RevisaoIAPainelProps) {
  return (
    <Card className="border-augusto-gold/20 overflow-hidden bg-augusto-gold/[0.02]">
      <div className="p-4 border-b border-augusto-gold/10 bg-augusto-gold/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-augusto-gold" />
          <h3 className="font-serif text-sm font-bold text-primary">Augusto revisou a pauta</h3>
        </div>
        {!loading && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRevisar}
            className="h-7 text-[10px] uppercase tracking-wider text-augusto-gold hover:bg-augusto-gold/10"
          >
            Revisar
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="py-6 flex flex-col items-center text-center space-y-3">
            <Loader2 className="h-8 w-8 text-augusto-gold animate-spin" />
            <p className="text-xs text-muted-foreground animate-pulse">
              Conferindo cada item contra a lei e a convenção...
            </p>
          </div>
        ) : error ? (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-xs font-medium">Falha na revisão</p>
            </div>
            <p className="text-[11px] text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={onRevisar} className="w-full h-8 text-xs">
              Tentar de novo
            </Button>
          </div>
        ) : alertas.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-muted-foreground">Clique em "Revisar pauta" para analisar a conformidade legal.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.sort((a, b) => a.ordem - b.ordem).map((alerta, idx) => (
              <div 
                key={idx}
                className={cn(
                  "p-3 rounded-md border-l-4 text-[11px] leading-relaxed relative group",
                  alerta.nivel === "info" && "bg-augusto-green/5 border-augusto-green/40 text-augusto-green",
                  alerta.nivel === "atencao" && "bg-augusto-gold/5 border-augusto-gold/40 text-augusto-gold",
                  alerta.nivel === "risco" && "bg-destructive/5 border-destructive/40 text-destructive"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      {alerta.nivel === "info" && <CheckCircle2 className="h-3 w-3" />}
                      {alerta.nivel === "atencao" && <AlertTriangle className="h-3 w-3" />}
                      {alerta.nivel === "risco" && <AlertCircle className="h-3 w-3" />}
                      Item {alerta.ordem}
                    </p>
                    <p>{alerta.mensagem}</p>
                    {alerta.fundamento_legal && (
                      <p className="opacity-70 italic mt-1 font-serif">{alerta.fundamento_legal}</p>
                    )}
                  </div>
                  {alerta.quorum_sugerido && onAplicarSugestao && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-1.5 text-[9px] uppercase border border-current opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => onAplicarSugestao(alerta)}
                    >
                      Aplicar sugestão
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
