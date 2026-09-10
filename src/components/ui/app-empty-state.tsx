import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppEmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tip,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  tip?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 px-6 py-12 text-center rounded-[var(--app-radius)] animate-augusto-fade-up",
        className,
      )}
    >
      {icon ? (
        <span className="app-icon-frame h-14 w-14 rounded-[var(--app-radius-lg)] shadow-xs [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </span>
      ) : null}
      <h3 className="app-section-title text-foreground font-medium">{title}</h3>
      {description ? (
        <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {action}
          {secondaryAction}
        </div>
      )}
      {tip ? (
        <p className="mt-2 text-xs text-muted-foreground/80 italic max-w-[40ch]">
          💡 {tip}
        </p>
      ) : null}
    </div>
  );
}

export default AppEmptyState;