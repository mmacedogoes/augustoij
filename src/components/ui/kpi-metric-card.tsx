import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface KpiDelta {
  value: string | number;
  trend?: "up" | "down" | "neutral";
  period?: string;
  isPositive?: boolean;
}

export interface KpiMetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: KpiDelta;
  subtitle?: string;
  tone?: "default" | "gold" | "emerald" | "amber" | "rose" | "neutral";
  interactive?: boolean;
}

export const KpiMetricCard = React.forwardRef<HTMLDivElement, KpiMetricCardProps>(
  (
    {
      className,
      label,
      value,
      icon,
      delta,
      subtitle,
      tone = "default",
      interactive = false,
      onClick,
      ...props
    },
    ref
  ) => {
    const toneStyles: Record<
      string,
      {
        border: string;
        bg: string;
        iconBg: string;
        accent: string;
      }
    > = {
      default: {
        border: "border-border/60 hover:border-border",
        bg: "bg-card",
        iconBg: "bg-muted/80 text-foreground",
        accent: "text-foreground",
      },
      gold: {
        border: "border-augusto-gold/30 hover:border-augusto-gold/50",
        bg: "bg-gradient-to-br from-card via-card to-augusto-gold/[0.04]",
        iconBg: "bg-augusto-gold/15 text-augusto-gold ring-1 ring-augusto-gold/20",
        accent: "text-augusto-gold",
      },
      emerald: {
        border: "border-emerald-500/30 hover:border-emerald-500/50",
        bg: "bg-gradient-to-br from-card via-card to-emerald-500/[0.04]",
        iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
        accent: "text-emerald-600 dark:text-emerald-400",
      },
      amber: {
        border: "border-amber-500/30 hover:border-amber-500/50",
        bg: "bg-gradient-to-br from-card via-card to-amber-500/[0.04]",
        iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
        accent: "text-amber-600 dark:text-amber-400",
      },
      rose: {
        border: "border-destructive/30 hover:border-destructive/50",
        bg: "bg-gradient-to-br from-card via-card to-destructive/[0.04]",
        iconBg: "bg-destructive/15 text-destructive ring-1 ring-destructive/20",
        accent: "text-destructive",
      },
      neutral: {
        border: "border-border/40 hover:border-border/70",
        bg: "bg-card/70",
        iconBg: "bg-muted/60 text-muted-foreground",
        accent: "text-foreground",
      },
    };

    const style = toneStyles[tone] || toneStyles.default;

    return (
      <Card
        ref={ref}
        onClick={onClick}
        className={cn(
          "app-card p-4.5 flex flex-col justify-between h-full border shadow-xs transition-all duration-200",
          style.border,
          style.bg,
          interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {icon && (
            <div className={cn("p-1.5 rounded-lg shrink-0 transition-colors", style.iconBg)}>
              {icon}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-mono font-bold tabular-nums text-foreground tracking-tight">
              {value === undefined || value === null ? "…" : value}
            </p>

            {delta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight",
                  delta.trend === "up" && (delta.isPositive !== false ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive"),
                  delta.trend === "down" && (delta.isPositive === false ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"),
                  delta.trend === "neutral" && "bg-muted text-muted-foreground"
                )}
              >
                {delta.trend === "up" && <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />}
                {delta.trend === "down" && <ArrowDownRight className="h-3 w-3 stroke-[2.5]" />}
                {delta.trend === "neutral" && <Minus className="h-3 w-3" />}
                <span>{delta.value}</span>
              </span>
            )}
          </div>

          {(subtitle || delta?.period) && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
              {subtitle && <span>{subtitle}</span>}
              {delta?.period && (
                <span className="text-muted-foreground/70">· {delta.period}</span>
              )}
            </p>
          )}
        </div>
      </Card>
    );
  }
);
KpiMetricCard.displayName = "KpiMetricCard";
