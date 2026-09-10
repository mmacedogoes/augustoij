import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CalloutVariant = "critical" | "warning" | "info" | "success" | "gold";

export interface CalloutBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant;
  title: string;
  description?: React.ReactNode;
  badge?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const CalloutBanner = React.forwardRef<HTMLDivElement, CalloutBannerProps>(
  (
    {
      className,
      variant = "info",
      title,
      description,
      badge,
      icon,
      action,
      secondaryAction,
      dismissible,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    const [dismissed, setDismissed] = React.useState(false);

    if (dismissed) return null;

    const variantStyles: Record<
      CalloutVariant,
      {
        container: string;
        iconBg: string;
        iconColor: string;
        titleColor: string;
        badgeStyle: string;
        actionVariant: "destructive" | "augusto" | "outline" | "default";
        defaultIcon: React.ReactNode;
      }
    > = {
      critical: {
        container: "border-destructive/40 bg-destructive/[0.06] text-destructive",
        iconBg: "bg-destructive/15 text-destructive ring-destructive/20",
        iconColor: "text-destructive",
        titleColor: "text-destructive",
        badgeStyle: "bg-destructive/15 text-destructive border-destructive/30 font-bold",
        actionVariant: "destructive",
        defaultIcon: <AlertCircle className="h-5 w-5 stroke-[2.2]" />,
      },
      warning: {
        container: "border-amber-500/40 bg-amber-500/[0.06] text-amber-900 dark:text-amber-200",
        iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/20",
        iconColor: "text-amber-600 dark:text-amber-400",
        titleColor: "text-amber-900 dark:text-amber-100",
        badgeStyle: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold",
        actionVariant: "augusto",
        defaultIcon: <AlertTriangle className="h-5 w-5 stroke-[2.2]" />,
      },
      gold: {
        container: "border-augusto-gold/40 bg-augusto-gold/[0.06] text-foreground",
        iconBg: "bg-augusto-gold/15 text-augusto-gold ring-augusto-gold/20",
        iconColor: "text-augusto-gold",
        titleColor: "text-foreground",
        badgeStyle: "bg-augusto-gold/15 text-augusto-gold border-augusto-gold/30 font-semibold",
        actionVariant: "augusto",
        defaultIcon: <AlertTriangle className="h-5 w-5 stroke-[2.2]" />,
      },
      success: {
        container: "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-950 dark:text-emerald-200",
        iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        titleColor: "text-emerald-950 dark:text-emerald-100",
        badgeStyle: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold",
        actionVariant: "outline",
        defaultIcon: <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />,
      },
      info: {
        container: "border-border bg-muted/30 text-foreground",
        iconBg: "bg-muted text-muted-foreground ring-border",
        iconColor: "text-muted-foreground",
        titleColor: "text-foreground",
        badgeStyle: "bg-muted text-muted-foreground border-border font-medium",
        actionVariant: "outline",
        defaultIcon: <Info className="h-5 w-5 stroke-[2.2]" />,
      },
    };

    const style = variantStyles[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 shadow-xs transition-all duration-200",
          style.container,
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105",
              style.iconBg
            )}
          >
            {icon || style.defaultIcon}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={cn("text-xs font-bold uppercase tracking-wider", style.titleColor)}>
                {title}
              </h4>
              {badge && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4.5", style.badgeStyle)}>
                  {badge}
                </Badge>
              )}
            </div>

            {description && (
              <div className="text-xs leading-relaxed text-muted-foreground font-normal">
                {description}
              </div>
            )}
            {children}
          </div>
        </div>

        {/* Action Buttons & Dismiss */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
          {secondaryAction && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}

          {action && (
            <Button
              type="button"
              variant={style.actionVariant}
              size="sm"
              className="h-8 text-xs font-semibold shadow-xs"
              onClick={action.onClick}
            >
              {action.icon || null}
              {action.label}
              {!action.icon && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          )}

          {dismissible && (
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                onDismiss?.();
              }}
              className="p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar alerta</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);
CalloutBanner.displayName = "CalloutBanner";
