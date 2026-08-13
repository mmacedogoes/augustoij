import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ClipboardList, TrendingUp, UserX, FileWarning, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PendenciaTipo = 
  | "reajuste" 
  | "checklist" 
  | "nao_conformidade" 
  | "sem_responsavel" 
  | "sem_indice" 
  | "mes_base_ausente" 
  | "documento_ausente";

interface PendenciasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoFiltro?: PendenciaTipo;
  condominioId?: string | null;
}

export function PendenciasDrawer({ open, onOpenChange, tipoFiltro, condominioId }: PendenciasDrawerProps) {
  // In a real implementation, we would fetch the specific list here based on filters.
  // For P0, we will show a placeholder UI that directs to the correct routes.
  
  const titulo = {
    reajuste: "Reajustes Pendentes",
    checklist: "Checklists Pendentes",
    nao_conformidade: "Não Conformidades",
    sem_responsavel: "Contratos sem Responsável",
    sem_indice: "Sem Índice de Reajuste",
    mes_base_ausente: "Mês-base Ausente",
    documento_ausente: "Documentos Ausentes",
  }[tipoFiltro ?? "checklist"] ?? "Pendências";

  const icone = {
    reajuste: <TrendingUp className="h-5 w-5 text-augusto-gold" />,
    checklist: <ClipboardList className="h-5 w-5 text-augusto-gold" />,
    nao_conformidade: <AlertTriangle className="h-5 w-5 text-destructive" />,
    sem_responsavel: <UserX className="h-5 w-5 text-augusto-gold" />,
    sem_indice: <FileWarning className="h-5 w-5 text-augusto-gold" />,
    mes_base_ausente: <AlertTriangle className="h-5 w-5 text-augusto-gold" />,
    documento_ausente: <FileWarning className="h-5 w-5 text-augusto-gold" />,
  }[tipoFiltro ?? "checklist"] ?? <AlertTriangle className="h-5 w-5 text-augusto-gold" />;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full">
        <SheetHeader className="pb-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              {icone}
            </div>
            <div>
              <SheetTitle className="font-serif text-xl">{titulo}</SheetTitle>
              <SheetDescription>
                Lista de pendências que requerem sua atenção imediata.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] py-6">
          <div className="space-y-4 pr-4">
            {/* 
               Aqui implementaríamos a listagem real. 
               Para P0, redirecionamos para a listagem filtrada ou mostramos uma lista mock.
            */}
            <div className="bg-muted/30 border border-augusto-gold/20 rounded-lg p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Estamos carregando a fila operacional para {titulo.toLowerCase()}.
              </p>
              <Button variant="augusto" size="sm" asChild onClick={() => onOpenChange(false)}>
                <Link to="/app/contratos" search={{ cid: condominioId ?? undefined }}>
                  Ir para listagem avançada <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
