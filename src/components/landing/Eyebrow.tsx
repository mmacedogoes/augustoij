import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  align = "left",
  className,
}: {
  children: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-augusto-gold",
        align === "center" && "text-center",
        className,
      )}
    >
      <span className="h-px w-8 bg-augusto-gold/55" aria-hidden="true" />
      {children}
      {align === "center" && <span className="h-px w-8 bg-augusto-gold/55" aria-hidden="true" />}
    </div>
  );
}

export default Eyebrow;