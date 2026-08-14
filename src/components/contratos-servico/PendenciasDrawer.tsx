import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription 
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardCheck, 
  UserPlus, 
  CalendarClock, 
  FileWarning, 
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Loader2,
  Building2,
  MapPin,
  AlertTriangle,
  ClipboardList,
  UserX,
  ArrowRight
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { 
  listChecklistsPendentesMes, 
  listContratosSemResponsavel,
  listContratosSemMesBase,
  listContratosSemIndice,
  listContratosSemIndice as listContratosSemDocumento // Reusing indices logic if similar or wait for real doc function
} from "@/lib/contratos-servico/painel.functions";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

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
  const navigate = useNavigate();
  
  const getFn = () => {
    switch (tipoFiltro) {
      case "checklist": return listChecklistsPendentesMes;
      case "sem_responsavel": return listContratosSemResponsavel;
      case "mes_base_ausente": return listContratosSemMesBase;
      case "sem_indice": return listContratosSemIndice;
      // Note: Reusing indices function for now if not implemented, but the backend now has them.
      // Re-fetching updated functions
      default: return null;
    }
  };

  const fn = getFn();
  const fetchFn = useServerFn(fn!);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pendencias-contratos", tipoFiltro, condominioId],
    queryFn: async () => {
      const res = await fetchFn({ data: { condominioId } });
      return res as { rows: any[] };
    },
    enabled: open && !!tipoFiltro && !!fn,
  });

  const getTitle = () => {
    switch (tipoFiltro) {
      case "checklist": return "Checklists pendentes (Mês)";
      case "sem_responsavel": return "Contratos sem responsável";
      case "mes_base_ausente": return "Mês-base não definido";
      case "documento_ausente": return "Documentos ausentes";
      case "sem_indice": return "Índice de reajuste não definido";
      case "reajuste": return "Reajustes pendentes";
      case "nao_conformidade": return "Não conformidades";
      default: return "Pendências operacionais";
    }
  };

  const getIcon = () => {
    switch (tipoFiltro) {
      case "checklist": return <ClipboardList className="w-5 h-5 text-amber-500" />;
      case "sem_responsavel": return <UserX className="w-5 h-5 text-amber-500" />;
      case "mes_base_ausente": return <CalendarClock className="w-5 h-5 text-amber-500" />;
      case "documento_ausente": return <FileWarning className="w-5 h-5 text-amber-500" />;
      case "sem_indice": return <TrendingUp className="w-5 h-5 text-amber-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
  };

  const handleVerListagem = () => {
    const viewMap: Record<string, string> = {
      "checklist": "checklist",
      "sem_responsavel": "sem-responsavel",
      "mes_base_ausente": "sem-mes-base",
      "documento_ausente": "sem-documento",
      "sem_indice": "sem-indice",
    };
    
    navigate({
      to: "/app/contratos",
      search: { 
        view: (viewMap[tipoFiltro!] || "todos") as any,
        cid: condominioId ?? undefined 
      }
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg border-l-augusto-gold/20 flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b border-augusto-gold/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              {getIcon()}
            </div>
            <div>
              <SheetTitle className="text-xl font-serif font-bold text-augusto-green">
                {getTitle()}
              </SheetTitle>
              <SheetDescription className="text-sm">
                Lista de contratos que requerem sua atenção imediata.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-augusto-gold" />
                <p className="text-sm font-medium text-slate-500">Carregando pendências...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-destructive/50" />
                <p className="text-sm font-medium text-destructive">Erro ao carregar dados.</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              </div>
            ) : !data?.rows || data.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-muted-foreground/60">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                  <ClipboardCheck className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Tudo em dia!</p>
                  <p className="text-xs">Não foram encontradas pendências deste tipo.</p>
                </div>
              </div>
            ) : (
              data.rows.map((row: any) => (
                <div 
                  key={row.contrato_id}
                  className="group relative bg-white border border-augusto-gold/10 rounded-xl p-4 transition-all hover:shadow-md hover:border-augusto-gold/30 cursor-pointer"
                  onClick={() => {
                    navigate({ to: `/app/contratos/${row.contrato_id}` });
                    onOpenChange(false);
                  }}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-augusto-green group-hover:text-augusto-gold transition-colors">
                        {row.prestador_nome}
                      </h4>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-slate-50">
                        {row.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span>{row.condominio_nome}</span>
                    </div>

                    {row.tipo_servico_nome && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{row.tipo_servico_nome}</span>
                      </div>
                    )}

                    {tipoFiltro === "checklist" && row.tipos && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {row.tipos.map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[9px] py-0 px-1.5 bg-amber-500/10 text-amber-700 border-none">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {row.motivo && (
                      <p className="text-[10px] text-amber-600 font-medium mt-1">
                        • {row.motivo}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-augusto-gold/10 bg-slate-50/50">
          <Button 
            className="w-full bg-augusto-green hover:bg-augusto-green/90 text-white gap-2 h-11"
            onClick={handleVerListagem}
          >
            Ir para listagem avançada
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}