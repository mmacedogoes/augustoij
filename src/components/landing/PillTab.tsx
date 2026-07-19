import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PillTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold active:scale-[0.98]",
        active
          ? "bg-augusto-gold text-augusto-green shadow-[var(--landing-shadow-soft)]"
          : "border border-augusto-gold/35 bg-augusto-cream/10 text-augusto-cream hover:border-augusto-gold hover:bg-augusto-cream/15 hover:text-augusto-gold-light",
      )}
    >
      {children}
    </button>
  );
}

export default PillTab;