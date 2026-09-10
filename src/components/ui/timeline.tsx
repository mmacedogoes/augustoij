import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  children: React.ReactNode;
}

export const Timeline = React.forwardRef<HTMLOListElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <ol
        ref={ref}
        className={cn("relative border-l border-border/70 ml-3.5 space-y-6 py-1", className)}
        {...props}
      >
        {children}
      </ol>
    );
  }
);
Timeline.displayName = "Timeline";

export interface TimelineItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  active?: boolean;
  status?: "default" | "success" | "warning" | "destructive" | "muted";
}

export const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ className, active, status = "default", children, ...props }, ref) => {
    return (
      <li
        ref={ref}
        className={cn(
          "group relative pl-6 transition-all duration-200",
          active && "opacity-100",
          className
        )}
        {...props}
      >
        {children}
      </li>
    );
  }
);
TimelineItem.displayName = "TimelineItem";

export interface TimelineIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "gold" | "muted";
}

export const TimelineIcon = React.forwardRef<HTMLSpanElement, TimelineIconProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-background border-border text-foreground ring-border/50",
      gold: "bg-augusto-gold/15 border-augusto-gold text-augusto-gold ring-augusto-gold/30",
      success: "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
      warning: "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 ring-amber-500/30",
      destructive: "bg-destructive/15 border-destructive text-destructive ring-destructive/30",
      muted: "bg-muted/80 border-muted-foreground/30 text-muted-foreground ring-border/30",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "absolute -left-[1.0625rem] top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-xs font-semibold shadow-xs ring-4 ring-background transition-transform duration-200 group-hover:scale-110",
          variants[variant],
          className
        )}
        {...props}
      >
        {children || <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
    );
  }
);
TimelineIcon.displayName = "TimelineIcon";

export interface TimelineHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TimelineHeader = React.forwardRef<HTMLDivElement, TimelineHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center justify-between gap-1.5", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TimelineHeader.displayName = "TimelineHeader";

export interface TimelineTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const TimelineTitle = React.forwardRef<HTMLHeadingElement, TimelineTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h4
        ref={ref}
        className={cn("text-xs font-bold uppercase tracking-wider text-foreground", className)}
        {...props}
      >
        {children}
      </h4>
    );
  }
);
TimelineTitle.displayName = "TimelineTitle";

export interface TimelineTimeProps extends React.HTMLAttributes<HTMLTimeElement> {}

export const TimelineTime = React.forwardRef<HTMLTimeElement, TimelineTimeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <time
        ref={ref}
        className={cn("text-[11px] font-medium text-muted-foreground tabular-nums", className)}
        {...props}
      >
        {children}
      </time>
    );
  }
);
TimelineTime.displayName = "TimelineTime";

export interface TimelineDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const TimelineDescription = React.forwardRef<HTMLParagraphElement, TimelineDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("mt-1 text-xs leading-relaxed text-muted-foreground", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
TimelineDescription.displayName = "TimelineDescription";

export interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("mt-2 rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-foreground", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TimelineContent.displayName = "TimelineContent";