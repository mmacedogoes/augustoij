import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Calendar, 
  User, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  ArrowUpRight,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  Edit2,
  UserPlus
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ContratoStatusBadge } from "./ContratoStatusBadge";
import { type ContratoLinha } from "@/lib/contratos-servico/contratos.functions";
import { cn } from "@/lib/utils";

interface QuickViewDrawerProps {
  contrato: ContratoLinha | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewDrawer({ contrato, open, onOpenChange }: QuickViewDrawerProps) {
  if (!contrato) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full p-0">
        <SheetHeader className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <ContratoStatusBadge status={contrato.status} />
              <SheetTitle className="font-serif text-2xl mt-2">{contrato.prestador_nome}</SheetTitle>
              <SheetDescription className="uppercase tracking-widest text-[10px] font-bold">
                {contrato.tipo_servico_nome ?? "Serviço Geral"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Resumo Rápido */}
            <div className="grid grid-cols-2 gap-4">
              <InfoBlock 
                icon={<Building2 className="h-4 w-4" />} 
                label="Condomínio" 
                value={contrato.condominio_nome} 
              />
              <InfoBlock 
                icon={<Calendar className="h-4 w-4" />} 
                label="Vigência" 
                value={contrato.prazo_indeterminado ? "Indeterminado" : formatDate(contrato.data_fim)} 
              />
              <InfoBlock 
                icon={<TrendingUp className="h-4 w-4" />} 
                label="Valor" 
                value={contrato.valor ? formatBRL(Number(contrato.valor)) : "—"} 
                subValue={contrato.tipo_valor === "mensal" ? "Mensal" : "Global"}
              />
              <InfoBlock 
                icon={<User className="h-4 w-4" />} 
                label="Responsável" 
                value="Não atribuído" // TODO: Fetch real responsible
                isWarning={true}
              />
            </div>

            {/* Saúde e Pendências */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> Saúde e Governança
              </h4>
              <div className="grid gap-2">
                <HealthItem 
                  label="Documento Original" 
                  status={contrato.documento_id ? "ok" : "warning"} 
                  desc={contrato.documento_id ? "Presente" : "Arquivo ausente"}
                />
                <HealthItem 
                  label="Checklists Mensais" 
                  status="ok" 
                  desc="Em dia"
                />
                <HealthItem 
                  label="Mês-base Reajuste" 
                  status="warning" 
                  desc="Não configurado"
                />
              </div>
            </div>

            {/* Próximo Evento */}
            <div className="bg-augusto-gold/5 border border-augusto-gold/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-augusto-gold" />
                <span className="text-xs font-bold text-augusto-gold uppercase">Próxima Ação</span>
              </div>
              <p className="text-sm font-medium text-primary">Revisar reajuste anual</p>
              <p className="text-xs text-muted-foreground mt-1">Vence em 15 dias (01/09/2026)</p>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 border-t border-border bg-muted/10 mt-auto">
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button variant="augusto" className="flex-1" asChild>
              <Link 
                to="/app/contratos/$contratoId" 
                params={{ contratoId: contrato.id }}
                onClick={() => onOpenChange(false)}
              >
                Abrir Contrato <ArrowUpRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function InfoBlock({ icon, label, value, subValue, isWarning }: { 
  icon: React.ReactNode, 
  label: string, 
  value: string, 
  subValue?: string,
  isWarning?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("text-sm font-serif", isWarning ? "text-augusto-gold" : "text-primary")}>
        {value}
      </p>
      {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
    </div>
  );
}

function HealthItem({ label, status, desc }: { label: string, status: "ok" | "warning" | "error", desc: string }) {
  const Icon = status === "ok" ? ShieldCheck : status === "warning" ? AlertTriangle : AlertTriangle;
  const color = status === "ok" ? "text-augusto-green" : status === "warning" ? "text-augusto-gold" : "text-destructive";
  const bg = status === "ok" ? "bg-augusto-green/5" : status === "warning" ? "bg-augusto-gold/5" : "bg-destructive/5";
  
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-md border border-border/50", bg)}>
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", color)} />
        <div>
          <p className="text-[11px] font-bold text-primary">{label}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
