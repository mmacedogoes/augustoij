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
        "text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Eyebrow;