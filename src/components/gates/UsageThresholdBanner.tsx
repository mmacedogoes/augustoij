import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUsoAtual } from "@/lib/uso.functions";
import type { UsoAtual } from "@/lib/uso-limits";
import { supabase } from "@/integrations/supabase/client";

type Threshold = 80 | 95;

/**
 * Banner discreto que aparece quando o consumo mensal cruza 80% ou 95%.
 * - Dispensável (sessionStorage por mês/plano/threshold para não voltar
 *   na mesma sessão).
 * - Some se o consumo cair abaixo do threshold ou virar plano ilimitado.
 */
export function UsageThresholdBanner() {
  const fetchUso = useServerFn(getUsoAtual);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setHasSession(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const { data } = useQuery<UsoAtual>({
    queryKey: ["uso-atual"],
    queryFn: () => fetchUso() as unknown as Promise<UsoAtual>,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: hasSession,
  });

  const info = useMemo(() => computarThreshold(data), [data]);
  const storageKey = info
    ? `usage-banner:${info.mesAno}:${info.planoId}:${info.threshold}`
    : null;

  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    setDismissed(sessionStorage.getItem(storageKey));
  }, [storageKey]);

  if (!info || (storageKey && dismissed === "1")) return null;

  const isCritical = info.threshold === 95;
  const titulo = isCritical
    ? `Você já usou ${info.pctInteiro}% das mensagens deste mês.`
    : `Você já usou ${info.pctInteiro}% das suas mensagens deste mês.`;
  const complemento = isCritical
    ? "Considere fazer upgrade para não interromper seu trabalho."
    : null;

  return (
    <div
      role="status"
      className={cn(
        "sticky top-0 z-40 flex flex-col gap-2 border-b px-4 py-2.5 text-sm shadow-sm",
        "sm:flex-row sm:items-center sm:justify-between",
        "transition-colors duration-200",
        isCritical
          ? "border-destructive/25 bg-destructive/10 text-destructive-foreground"
          : "border-usage-warn/30 bg-usage-warn/10",
      )}
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <AlertCircle
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0 sm:mt-0",
            isCritical ? "text-destructive" : "text-usage-warn",
          )}
          strokeWidth={2}
        />
        <p className="leading-snug text-foreground">
          <span className="font-semibold">{titulo}</span>
          {complemento && (
            <span className="ml-1 text-muted-foreground">{complemento}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button asChild size="sm" variant={isCritical ? "default" : "secondary"} className="gap-1.5">
          <Link to="/app/conta">
            <Sparkles className="h-3.5 w-3.5" /> Fazer upgrade
          </Link>
        </Button>
        <button
          type="button"
          onClick={() => {
            if (storageKey) sessionStorage.setItem(storageKey, "1");
            setDismissed("1");
          }}
          aria-label="Dispensar aviso"
          className={cn(
            "grid place-items-center h-8 w-8 rounded-md text-muted-foreground",
            "transition-colors duration-200 hover:text-foreground hover:bg-foreground/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function computarThreshold(uso: UsoAtual | undefined): {
  threshold: Threshold;
  pctInteiro: number;
  mesAno: string;
  planoId: string;
} | null {
  if (!uso || uso.cortesia || uso.limiteMes === null) return null;
  const pct = (uso.mensagensMes / Math.max(1, uso.limiteMes)) * 100;
  if (pct < 80) return null;
  const threshold: Threshold = pct >= 95 ? 95 : 80;
  return {
    threshold,
    pctInteiro: Math.min(100, Math.floor(pct)),
    mesAno: uso.resetMesIso.slice(0, 7),
    planoId: uso.planoId,
  };
}