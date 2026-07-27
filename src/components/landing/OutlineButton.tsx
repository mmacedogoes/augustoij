import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const OutlineButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "dark" | "light" }
>(function OutlineButton({ className, children, tone = "dark", ...props }, ref) {
  return (
    <button
      ref={ref}
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm border bg-transparent px-6 py-3 font-body text-[15px] font-medium transition-colors duration-200 ease-out",
        tone === "dark"
          ? "border-dourado text-dourado-texto hover:bg-dourado/10 active:bg-dourado/15"
          : "border-dourado text-dourado-claro hover:bg-dourado-claro/10 active:bg-dourado-claro/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2",
        tone === "dark" ? "focus-visible:ring-offset-cream" : "focus-visible:ring-offset-verde-profundo",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
});

export default OutlineButton;