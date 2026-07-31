import { AppSkeleton } from "@/components/ui/app-skeleton";

/** Alias do AppSkeleton para uniformizar o brilho em todo o app. */
function Skeleton(props: React.HTMLAttributes<HTMLDivElement>) {
  return <AppSkeleton {...props} />;
}

export { Skeleton };
