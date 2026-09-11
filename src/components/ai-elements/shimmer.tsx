"use client";

import { cn } from "@/lib/utils";
import type { ElementType, HTMLAttributes } from "react";
import { memo } from "react";

export interface TextShimmerProps extends HTMLAttributes<HTMLElement> {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  ...props
}: TextShimmerProps) => {
  return (
    <Component
      className={cn(
        "relative inline-block animate-pulse bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
