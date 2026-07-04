import * as React from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { primeiroPlanoComFeature, type FeatureKey } from "@/lib/plan-gates";

type LockBadgeProps = {
  /** Feature bloqueada — usada para calcular o plano necessário. */
  feature?: FeatureKey;
  /** Ou passe o nome do plano diretamente (override). */
  planoNome?: string;
  /** Texto extra opcional dentro do tooltip. */
  descricao?: string;
  className?: string;
  /** Tamanho visual: `sm` (12px) padrão, `md` (14px) para itens maiores. */
  size?: "sm" | "md";
};

/**
 * Selo compacto de cadeado — usado ao lado de menus, botões ou linhas de
 * feature bloqueada. Mostra tooltip on hover/focus com o plano necessário.
 */
export function LockBadge({
  feature,
  planoNome,
  descricao,
  className,
  size = "sm",
}: LockBadgeProps) {
  const resolvido =
    planoNome ?? (feature ? primeiroPlanoComFeature(feature)?.nome : undefined);
  const tooltip = resolvido
    ? `Disponível no plano ${resolvido}`
    : "Disponível em planos superiores";

  const dims = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={tooltip}
            tabIndex={0}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "bg-muted text-muted-foreground",
              "border border-border/60",
              "transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "cursor-help select-none",
              dims,
              className,
            )}
          >
            <Lock className={icon} strokeWidth={2} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
          <p className="font-medium">{tooltip}</p>
          {descricao && (
            <p className="mt-0.5 text-muted-foreground">{descricao}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Wrapper para itens de menu/botão bloqueados: aplica opacidade + cursor
 * bloqueado nos filhos, adiciona `LockBadge` alinhado à direita e captura
 * o clique (chama `onLockedClick` — ex: abrir UpgradeDialog).
 */
export function LockedItem({
  feature,
  planoNome,
  onLockedClick,
  children,
  className,
}: {
  feature?: FeatureKey;
  planoNome?: string;
  onLockedClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onLockedClick}
      className={cn(
        "group w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left",
        "text-sm text-muted-foreground",
        "transition-colors duration-200",
        "hover:bg-muted/60 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <LockBadge feature={feature} planoNome={planoNome} />
    </button>
  );
}