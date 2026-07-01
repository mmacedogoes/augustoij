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
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-augusto-green text-augusto-cream"
          : "border border-augusto-green/30 text-augusto-green hover:border-augusto-green",
      )}
    >
      {children}
    </button>
  );
}

export default PillTab;