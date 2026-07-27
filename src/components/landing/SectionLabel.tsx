import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({
  children,
  tone = "dark",
  className,
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block font-body text-[11px] font-medium uppercase sm:text-[12px]",
        tone === "dark" ? "text-dourado-texto" : "text-dourado-claro",
        className,
      )}
      style={{ letterSpacing: "0.2em" }}
    >
      {children}
    </span>
  );
}

export default SectionLabel;