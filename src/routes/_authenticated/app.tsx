import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  // Skeleton dentro da área de conteúdo (o menu continua visível).
  pendingMs: 150,
  pendingMinMs: 0,
  pendingComponent: () => (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  ),
  errorComponent: ErroArea,
});

function ErroArea({ error }: { error: Error }) {
  const router = useRouter();
  return (
      <div className="mx-auto max-w-md text-center space-y-4 py-16">
        <h1 className="text-xl font-medium">Não foi possível carregar esta tela</h1>
        <p className="text-sm text-muted-foreground">
          {error?.message || "Verifique sua conexão e tente novamente."}
        </p>
        <Button onClick={() => router.invalidate()}>Tentar de novo</Button>
      </div>
  );
}
