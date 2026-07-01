import { cn } from "@/lib/utils";

export function GoldDivider({
  className,
  width = 60,
  center = true,
}: {
  className?: string;
  width?: number;
  center?: boolean;
}) {
  return (
    <div className={cn(center && "flex justify-center", className)}>
      <span
        className="block h-px bg-augusto-gold"
        style={{ width: `${width}px` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default GoldDivider;