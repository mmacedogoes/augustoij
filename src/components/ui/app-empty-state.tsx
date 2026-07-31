import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="app-icon-frame h-14 w-14 rounded-[var(--app-radius-lg)] [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </span>
      ) : null}
      <h3 className="app-section-title">{title}</h3>
      {description ? (
        <p className="max-w-[40ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export default AppEmptyState;