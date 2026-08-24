import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAssembleia } from '@/lib/assembleias/assembleias.functions';
import { montarConvocacao, getDadosConvocacao } from '@/lib/assembleias/convocacao.functions';
import { enviarConvocacaoEmail, registrarEntregaFisica } from '@/lib/assembleias/envio.functions';
import { registrarLinkWhatsApp, confirmarEnvioWhatsApp } from '@/lib/assembleias/whatsapp.functions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { 
  Mail, 
  MessageSquare, 
  FileText, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ExternalLink,
  Printer,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/app/assembleias/$assembleiaId/convocacao')({
  component: ConvocacaoAssembleiaPage
});

function ConvocacaoAssembleiaPage() {
  const { assembleiaId } = Route.useParams();
  const queryClient = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  // 1. Verificar se já existe convocação ou montar se necessário
  const { data: assembleia, isLoading: loadingAss } = useQuery({
    queryKey: ['assembleia', assembleiaId],
    queryFn: () => getAssembleia({ data: { id: assembleiaId } })
  });

  const { data: convocacao, isLoading: loadingConv } = useQuery({
    queryKey: ['convocacao', assembleiaId],
    queryFn: async () => {
      // Simplificando: Busca a última convocação ou monta uma nova
      const { data: existing } = await (await import('@/integrations/supabase/client')).supabase
        .from('assembleia_convocacoes')
        .select('*')
        .eq('assembleia_id', assembleiaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existing) return getDadosConvocacao({ data: { convocacaoId: existing.id } });
      
      const nova = await montarConvocacao({ data: { assembleiaId, tipo: 'edital' } });
      return getDadosConvocacao({ data: { convocacaoId: nova.id } });
    },
    enabled: !!assembleia
  });

  const stats = useMemo(() => {
    if (!convocacao?.destinatarios) return { total: 0, email: 0, whatsapp: 0, semContato: 0 };
    const ds = convocacao.destinatarios;
    return {
      total: ds.length,
      email: ds.filter((d: any) => !!d.email).length,
      whatsapp: ds.filter((d: any) => !!d.telefone_wa || !!d.telefone_bruto).length,
      semContato: ds.filter((d: any) => !d.email && !d.telefone_bruto).length
    };
  }, [convocacao]);

  const handleEnviarEmails = async () => {
    try {
      setEnviando(true);
      await enviarConvocacaoEmail({ data: { convocacaoId: convocacao.id } });
      toast.success("E-mails enviados com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['convocacao'] });
    } catch (e) {
      toast.error("Erro ao enviar e-mails.");
    } finally {
      setEnviando(false);
    }
  };

  if (loadingAss || loadingConv) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[#00512B]">Convocação</h1>
          <p className="text-muted-foreground">{assembleia?.titulo}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Entrega Física
          </Button>
          <Button onClick={handleEnviarEmails} disabled={enviando}>
            <Mail className="mr-2 h-4 w-4" />
            Enviar E-mails
          </Button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Unidades" value={stats.total} />
        <StatCard icon={Mail} label="Com E-mail" value={stats.email} sub={`${Math.round((stats.email/stats.total)*100)}% de cobertura`} />
        <StatCard icon={MessageSquare} label="Com WhatsApp" value={stats.whatsapp} sub={`${Math.round((stats.whatsapp/stats.total)*100)}% de cobertura`} />
        <StatCard 
          icon={AlertCircle} 
          label="Sem Contato" 
          value={stats.semContato} 
          variant="error" 
          sub="Exigem entrega física" 
        />
      </div>

      {/* Lembretes */}
      <Card className="p-6 border-[#E4E1D8] bg-muted/30">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-5 w-5 text-[#00512B]" />
          <h2 className="font-serif text-lg text-[#00512B]">Reenvios Programados</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ReminderToggle label="Lembrete 48h antes" />
          <ReminderToggle label="Lembrete 2h antes" />
          <ReminderToggle label="Aviso de continuada" disabled hint="Enviado automaticamente ao registrar a assembleia continuada" />
        </div>
      </Card>

      {/* Tabela de Destinatários */}
      <Card className="border-[#E4E1D8] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-[#E4E1D8] text-[#00512B] font-medium">
              <tr>
                <th className="px-6 py-4">Unidade e Contato</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E1D8]">
              {convocacao.destinatarios.map((d: any) => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{d.unidade_identificacao || 'Unidade'}</div>
                    <div className="text-xs text-muted-foreground">{d.nome}</div>
                  </td>
                  <td className="px-6 py-4">
                    <EmailStatusBadge status={d.status_email} time={d.email_enviado_em} />
                    {d.email && <div className="text-xs mt-1 text-muted-foreground">{d.email}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <WhatsAppAction 
                      destinatarioId={d.id} 
                      status={d.status_whatsapp} 
                      telefone={d.telefone_wa || d.telefone_bruto} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      <p className="text-xs text-muted-foreground italic text-center">
        O sistema não envia a mensagem de WhatsApp automaticamente. O botão abre a conversa com o texto pronto para o gestor conferir e enviar.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, variant = 'default' }: any) {
  return (
    <Card className={cn(
      "p-4 border-[#E4E1D8]",
      variant === 'error' && "border-red-200 bg-red-50/50"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          variant === 'error' ? "bg-red-100 text-red-600" : "bg-augusto-gold/10 text-augusto-gold"
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-serif text-[#00512B]">{value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
        </div>
      </div>
      {sub && <div className={cn(
        "mt-2 text-[11px] font-medium",
        variant === 'error' ? "text-red-600" : "text-augusto-gold"
      )}>{sub}</div>}
    </Card>
  );
}

function ReminderToggle({ label, disabled, hint }: any) {
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-lg border border-[#E4E1D8] bg-white", disabled && "opacity-50")}>
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-col items-end">
        <input type="checkbox" disabled={disabled} className="h-4 w-4 accent-[#00512B]" />
        {hint && <span className="text-[9px] text-muted-foreground mt-1">{hint}</span>}
      </div>
    </div>
  );
}

function EmailStatusBadge({ status, time }: any) {
  const config: any = {
    pendente: { label: 'Pendente', icon: Clock, className: 'bg-slate-100 text-slate-600' },
    enviado: { label: 'Enviado', icon: CheckCircle2, className: 'bg-blue-50 text-blue-600' },
    entregue: { label: 'Entregue', icon: CheckCircle2, className: 'bg-green-50 text-green-600' },
    aberto: { label: 'Aberto', icon: ExternalLink, className: 'bg-augusto-gold/10 text-augusto-gold' },
    falhou: { label: 'Falhou', icon: AlertCircle, className: 'bg-red-50 text-red-600' }
  };
  const c = config[status] || config.pendente;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", c.className)}>
      <c.icon className="h-3 w-3" />
      {c.label} {time && `às ${new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
    </Badge>
  );
}

function WhatsAppAction({ destinatarioId, status, telefone }: any) {
  const [loading, setLoading] = useState(false);
  const isEnviado = status === 'link_aberto' || status === 'confirmado';

  const handleOpen = async () => {
    if (!telefone) {
      toast.error("Telefone não cadastrado.");
      return;
    }
    // Lógica síncrona para window.open
    const url = `https://wa.me/${telefone.replace(/\D/g, '')}?text=Olá`;
    window.open(url, '_blank', 'noopener,noreferrer');
    
    // Registrar em background
    registrarLinkWhatsApp({ data: { destinatarioId } });
  };

  return (
    <Button 
      size="sm" 
      variant={isEnviado ? "outline" : "default"} 
      className={cn(
        "h-8 gap-2",
        !isEnviado && "bg-[#25D366] hover:bg-[#20ba5a] text-white border-none"
      )}
      onClick={handleOpen}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {isEnviado ? 'Link Aberto' : 'Enviar WhatsApp'}
    </Button>
  );
}
