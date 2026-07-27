import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function PrimaryButton({ className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-sm bg-dourado px-6 py-3 font-body text-[15px] font-medium text-[hsl(30_60%_9%)] transition-colors duration-200 ease-out",
          "hover:bg-[hsl(33_40%_47%)] active:bg-[hsl(33_40%_42%)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);

export default PrimaryButton;