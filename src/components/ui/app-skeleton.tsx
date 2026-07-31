import { cn } from "@/lib/utils";

type AppSkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Placeholder de carregamento com brilho dourado (respeita prefers-reduced-motion). */
export function AppSkeleton({ className, ...props }: AppSkeletonProps) {
  return <div aria-hidden className={cn("app-skeleton h-4 w-full", className)} {...props} />;
}

/** Conveniência: n linhas de texto em skeleton. */
export function AppSkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Carregando">
      {Array.from({ length: lines }).map((_, i) => (
        <AppSkeleton key={i} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

export default AppSkeleton;