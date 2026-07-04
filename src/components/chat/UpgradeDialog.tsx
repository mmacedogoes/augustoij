import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, type PlanId } from "@/config/plans";
import { proximosPlanos } from "@/lib/uso-limits";
import {
  planosQueDesbloqueiam,
  primeiroPlanoComFeature,
  type FeatureKey,
} from "@/lib/plan-gates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoAtual: PlanId;
  /** Motivo do limite (para o textinho de header). Opcional quando `feature` está setada. */
  motivo?: "diario" | "mensal" | "trial_expirado" | "recurso_bloqueado";
  /** Quando setado, o modal filtra apenas planos que desbloqueiam esta feature. */
  feature?: FeatureKey;
  /** Override manual do texto do header. */
  titulo?: string;
  descricao?: string;
};

const RESUMO: Record<PlanId, { tagline: string; highlights: string[]; recommended?: boolean }> = {
  gratuito: { tagline: "Teste inicial", highlights: [] },
  essencial: {
    tagline: "Para síndicos moradores",
    highlights: ["100 mensagens/mês", "Até 2 condomínios", "Upload de documentos"],
  },
  profissional: {
    tagline: "Para síndicos profissionais e advogados",
    highlights: [
      "400 mensagens/mês",
      "Até 8 condomínios",
      "Jurisprudência completa",
      "Minutas de ata e convenção",
    ],
    recommended: true,
  },
  gestao: {
    tagline: "Para síndicos com carteira ampla",
    highlights: ["900 mensagens/mês", "Até 20 condomínios", "3 usuários inclusos"],
  },
  administradora: {
    tagline: "Para administradoras",
    highlights: ["Mensagens ilimitadas", "Até 50 condomínios", "Usuários ilimitados"],
  },
  personalizado: {
    tagline: "Sob medida",
    highlights: ["Condomínios ilimitados", "White-label", "Gerente dedicado"],
  },
};

function motivoTitulo(
  motivo: NonNullable<Props["motivo"]>,
  featureNome?: string | null,
): { titulo: string; descricao: string } {
  switch (motivo) {
    case "diario":
      return {
        titulo: "Limite diário atingido",
        descricao:
          "Você usou todas as mensagens de hoje no plano Gratuito. Faça upgrade para continuar agora.",
      };
    case "trial_expirado":
      return {
        titulo: "Seu período gratuito encerrou",
        descricao:
          "Escolha o plano ideal para o seu volume de trabalho e continue com o Augusto sem interrupção.",
      };
    case "recurso_bloqueado":
      return {
        titulo: "Recurso disponível em planos superiores",
        descricao: featureNome
          ? `${featureNome} está disponível em planos superiores. Faça upgrade para desbloquear.`
          : "Faça upgrade para desbloquear este recurso.",
      };
    case "mensal":
    default:
      return {
        titulo: "Limite mensal atingido",
        descricao:
          "Você usou todas as mensagens do plano atual neste mês. Faça upgrade para continuar agora ou aguarde a renovação.",
      };
  }
}

const FEATURE_LABEL: Record<FeatureKey, string> = {
  uploadDocumentos: "Upload de documentos",
  analiseContratos: "Análise de contratos",
  modelosDocumentos: "Modelos e minutas",
  jurisprudenciaCompleta: "Jurisprudência completa",
  minutasAtaConvencao: "Minutas de ata e convenção",
  relatoriosPorCondominio: "Relatórios por condomínio",
  suportePrioritario: "Suporte prioritário",
};

export function UpgradeDialog({
  open,
  onOpenChange,
  planoAtual,
  motivo,
  feature,
  titulo: tituloOverride,
  descricao: descOverride,
}: Props) {
  const navigate = useNavigate();
  const upgrades: PlanId[] = feature
    ? planosQueDesbloqueiam(planoAtual, feature).map((p) => p.id)
    : proximosPlanos(planoAtual);
  const featureNome = feature ? FEATURE_LABEL[feature] : null;
  const primeiro = feature ? primeiroPlanoComFeature(feature) : null;
  const recomendadoId: PlanId | null =
    primeiro && upgrades.includes(primeiro.id) ? primeiro.id : upgrades[0] ?? null;
  const base = motivoTitulo(motivo ?? (feature ? "recurso_bloqueado" : "mensal"), featureNome);
  const titulo = tituloOverride ?? base.titulo;
  const descricao = descOverride ?? base.descricao;

  const handleEscolher = (id: PlanId) => {
    onOpenChange(false);
    if (id === "personalizado") {
      window.location.href = "mailto:contato@augusto.ij?subject=Plano%20Personalizado";
      return;
    }
    navigate({ to: "/signup", search: { plano: id, ciclo: "mensal" } } as never);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="text-lg leading-tight">{titulo}</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-sm leading-relaxed">
            {descricao}
          </DialogDescription>
        </DialogHeader>

        {upgrades.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            Você já está no plano mais alto disponível. Fale com a nossa equipe para uma solução
            personalizada.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {upgrades.map((id) => {
              const plano = PLANS[id];
              const info = RESUMO[id];
              const recomendado = feature ? id === recomendadoId : !!info.recommended;
              return (
                <li
                  key={id}
                  className={cn(
                    "group relative flex flex-col rounded-lg border bg-card p-4 transition-all duration-200",
                    "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                    recomendado
                      ? "border-primary/60 shadow-sm ring-1 ring-primary/20"
                      : "border-border",
                  )}
                >
                  {recomendado && (
                    <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground">
                      Recomendado
                    </span>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      {plano.nome}
                    </h3>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {info.tagline}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {info.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/85"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={recomendado ? "default" : "outline"}
                    className="mt-4 w-full transition-transform duration-200 active:scale-[0.98]"
                    onClick={() => handleEscolher(id)}
                  >
                    {id === "personalizado" ? "Falar com a equipe" : `Assinar ${plano.nome}`}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex justify-center">
          <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
            <Link to="/" hash="planos" onClick={() => onOpenChange(false)}>
              Ver todos os planos <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeDialog;