import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlanContext, type PlanContext } from "@/lib/plan-context.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook único para ler o contexto de plano no cliente.
 * Cache curto (60s) — as ações ainda são validadas no servidor.
 *
 * A sessão inicial vem síncrona do storage (o supabase-js já a carrega),
 * então evitamos um getSession() extra por montagem — só reagimos a mudanças.
 */
export function usePlanContext() {
  const fetchCtx = useServerFn(getPlanContext);
  const [hasSession, setHasSession] = useState<boolean>(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return useQuery<PlanContext>({
    queryKey: ["plan-context"],
    queryFn: () => fetchCtx() as unknown as Promise<PlanContext>,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: hasSession,
    retry: false,
  });
}