import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlanContext, type PlanContext } from "@/lib/plan-context.functions";

/**
 * Hook único para ler o contexto de plano no cliente.
 * Cache curto (60s) — as ações ainda são validadas no servidor.
 */
export function usePlanContext() {
  const fetchCtx = useServerFn(getPlanContext);
  return useQuery<PlanContext>({
    queryKey: ["plan-context"],
    queryFn: () => fetchCtx() as unknown as Promise<PlanContext>,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}