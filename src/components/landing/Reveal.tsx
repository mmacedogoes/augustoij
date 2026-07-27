import { type ElementType, type ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

/**
 * Envoltório de fade-in on-scroll. Usa `useScrollReveal` (que respeita
 * prefers-reduced-motion). Aplica opacidade + leve translateY.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const ref = useScrollReveal<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "opacity-0 translate-y-3 will-change-transform",
        "transition-[opacity,transform] duration-[600ms] ease-out",
        "motion-reduce:transition-none motion-reduce:translate-y-0",
        "[&.is-visible]:opacity-100 [&.is-visible]:translate-y-0",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;