import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  activeStep: number;
  onStepClick?: (step: number) => void;
  children: React.ReactNode;
}

export const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, activeStep, onStepClick, children, ...props }, ref) => {
    const childrenArray = React.Children.toArray(children);

    return (
      <div
        ref={ref}
        className={cn("w-full space-y-4", className)}
        {...props}
      >
        <ol className="flex w-full items-center justify-between gap-2 overflow-x-auto py-2">
          {childrenArray.map((child, index) => {
            if (!React.isValidElement(child)) return null;
            const stepNumber = index + 1;
            const isCompleted = stepNumber < activeStep;
            const isCurrent = stepNumber === activeStep;
            const isUpcoming = stepNumber > activeStep;

            return React.cloneElement(child as React.ReactElement<any>, {
              key: index,
              step: stepNumber,
              isCompleted,
              isCurrent,
              isUpcoming,
              isLast: index === childrenArray.length - 1,
              onClick: () => {
                if (onStepClick && (isCompleted || isCurrent)) {
                  onStepClick(stepNumber);
                }
              },
            });
          })}
        </ol>
      </div>
    );
  }
);
Stepper.displayName = "Stepper";

export interface StepProps extends React.HTMLAttributes<HTMLLIElement> {
  step?: number;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  isCompleted?: boolean;
  isCurrent?: boolean;
  isUpcoming?: boolean;
  isLast?: boolean;
  onClick?: () => void;
}

export const Step = React.forwardRef<HTMLLIElement, StepProps>(
  (
    {
      className,
      step,
      title,
      description,
      icon,
      isCompleted,
      isCurrent,
      isUpcoming,
      isLast,
      onClick,
      ...props
    },
    ref
  ) => {
    return (
      <li
        ref={ref}
        className={cn(
          "flex flex-1 items-center gap-3 min-w-max",
          isLast && "flex-initial",
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={isUpcoming}
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-left transition-all duration-200 outline-none group",
            isUpcoming ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-90",
            isCurrent && "ring-1 ring-augusto-gold/30 bg-augusto-gold/[0.04] p-1.5 rounded-lg"
          )}
        >
          {/* Step Indicator Dot / Icon */}
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200 shadow-xs",
              isCompleted && "bg-augusto-green text-white border-augusto-green ring-2 ring-augusto-green/20",
              isCurrent && "bg-augusto-gold text-white border-augusto-gold ring-4 ring-augusto-gold/20 scale-105",
              isUpcoming && "bg-muted text-muted-foreground border-border/80"
            )}
          >
            {isCompleted ? (
              <Check className="h-4 w-4 stroke-[2.5]" />
            ) : icon ? (
              icon
            ) : (
              step
            )}
          </span>

          {/* Title & Description */}
          <div className="flex flex-col">
            <span
              className={cn(
                "text-xs font-bold tracking-tight transition-colors",
                isCurrent ? "text-augusto-gold font-extrabold" : isCompleted ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {title}
            </span>
            {description && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                {description}
              </span>
            )}
          </div>
        </button>

        {/* Separator Connector */}
        {!isLast && (
          <div
            className={cn(
              "h-0.5 flex-1 min-w-6 rounded-full transition-colors duration-200 hidden md:block",
              isCompleted ? "bg-augusto-green" : "bg-border/60"
            )}
          />
        )}
      </li>
    );
  }
);
Step.displayName = "Step";
