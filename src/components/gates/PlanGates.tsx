import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlanContext } from "@/hooks/usePlanContext";
import { gateMessages } from "@/lib/plan-gates";
import type { FeatureKey } from "@/lib/plan-gates";

/**
 * Banner fixo mostrado no topo do app quando o trial gratuito expirou.
 * Deixa o usuário só com Conta/Planos acessíveis (o guard de rota cuida
 * do resto).
 */
export function TrialExpiredBanner() {
  const { data } = usePlanContext();
  if (data?.status === "aguardando_pagamento") {
    return (
      <div
        role="alert"
        className={cn(
          "sticky top-0 z-50 flex flex-col gap-2 border-b border-primary/20",
          "bg-primary text-primary-foreground",
          "px-4 py-2.5 text-sm shadow-sm",
          "sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div className="flex items-start gap-2 sm:items-center">
          <CreditCard className="h-4 w-4 mt-0.5 shrink-0 sm:mt-0" strokeWidth={2} />
          <p className="font-medium leading-snug">
            Sua assinatura do plano {data.planoNome} está aguardando pagamento.
          </p>
        </div>
        <Button asChild size="sm" variant="secondary" className="self-start sm:self-auto shrink-0">
          <Link to="/app/conta">Concluir pagamento</Link>
        </Button>
      </div>
    );
  }
  if (!data?.trialExpirado) return null;
  return (
    <div
      role="alert"
      className={cn(
        "sticky top-0 z-50 flex flex-col gap-2 border-b border-destructive/20",
        "bg-destructive text-destructive-foreground",
        "px-4 py-2.5 text-sm shadow-sm",
        "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex items-start gap-2 sm:items-center">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 sm:mt-0" strokeWidth={2} />
        <p className="font-medium leading-snug">{gateMessages.trialExpirado()}</p>
      </div>
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="self-start sm:self-auto shrink-0"
      >
        <Link to="/app/conta">Ver planos</Link>
      </Button>
    </div>
  );
}

type PlanLockProps = {
  title: string;
  description?: string;
  /** Rota do upgrade — padrão /app/conta. */
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
};

/**
 * Card genérico "recurso bloqueado pelo plano" — usar em qualquer seção
 * que precise mostrar cadeado + CTA de upgrade.
 */
export function PlanLock({
  title,
  description,
  ctaHref = "/app/conta",
  ctaLabel = "Ver planos",
  className,
}: PlanLockProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/40",
        "p-5 sm:p-6 flex flex-col items-start gap-3",
        "transition-colors duration-200 hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-foreground">
        <span className="grid place-items-center h-8 w-8 rounded-md bg-primary/10 text-primary">
          <Lock className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <p className="font-semibold leading-tight">{title}</p>
      </div>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      <Button asChild size="sm" className="gap-1.5 mt-1">
        <Link to={ctaHref}>
          <Sparkles className="h-3.5 w-3.5" /> {ctaLabel}
        </Link>
      </Button>
    </div>
  );
}

/**
 * Wrapper declarativo: renderiza `children` só se o plano incluir a feature;
 * caso contrário mostra o `<PlanLock />` (ou nada, se `hideWhenBlocked`).
 */
export function FeatureGate({
  feature,
  title,
  description,
  hideWhenBlocked = false,
  children,
}: {
  feature: FeatureKey;
  title?: string;
  description?: string;
  hideWhenBlocked?: boolean;
  children: React.ReactNode;
}) {
  const { data, isLoading } = usePlanContext();
  if (isLoading) return null;
  const allowed = data ? data.recursos[feature] === true : false;
  if (allowed) return <>{children}</>;
  if (hideWhenBlocked) return null;
  return (
    <PlanLock
      title={title ?? "Recurso disponível em planos superiores"}
      description={description}
    />
  );
}