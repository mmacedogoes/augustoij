import { cn } from "@/lib/utils";

type UsageMeterProps = {
  used: number;
  limit: number | null;
  label?: string;
  /** Rótulo curto exibido junto — ex: "mensagens deste mês". */
  unit?: string;
  className?: string;
};

/**
 * Barra de progresso de consumo com 3 zonas:
 *  - ≤ 70%  → success (verde)
 *  - 70–90% → warning (amarelo)
 *  - > 90%  → destructive (vermelho)
 *
 * `limit=null` (ilimitado) mostra apenas o contador, sem barra.
 */
export function UsageMeter({ used, limit, label, unit, className }: UsageMeterProps) {
  const isIlimitado = limit === null;
  const pct = isIlimitado ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);

  const tone: "success" | "warning" | "danger" =
    pct > 90 ? "danger" : pct >= 70 ? "warning" : "success";

  const barColor = {
    success: "bg-[hsl(var(--usage-ok))]",
    warning: "bg-[hsl(var(--usage-warn))]",
    danger: "bg-[hsl(var(--usage-alert))]",
  }[tone];

  const textColor = {
    success: "text-foreground",
    warning: "text-[hsl(var(--usage-warn-fg))]",
    danger: "text-destructive",
  }[tone];

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || unit) && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">{label}</span>
          <span className={cn("tabular-nums font-semibold", textColor)}>
            {used.toLocaleString("pt-BR")}
            {isIlimitado ? (
              <span className="ml-1 font-normal text-muted-foreground">/ ilimitado</span>
            ) : (
              <>
                <span className="mx-0.5 text-muted-foreground/70">/</span>
                <span className="text-muted-foreground">{limit!.toLocaleString("pt-BR")}</span>
              </>
            )}
            {unit && <span className="ml-1 font-normal text-muted-foreground">{unit}</span>}
          </span>
        </div>
      )}
      {!isIlimitado && (
        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ?? "Consumo"}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              barColor,
            )}
            style={{ width: `${Math.max(pct, used > 0 ? 3 : 0)}%` }}
          />
        </div>
      )}
    </div>
  );
}