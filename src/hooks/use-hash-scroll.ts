import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Rola suavemente até o elemento cujo id corresponde ao hash da URL.
 * Tenta encontrar o elemento por ~800ms para cobrir o caso da rota
 * ainda estar montando quando o hash muda. Respeita prefers-reduced-motion.
 */
export function useHashScroll() {
  const hash = useLocation({ select: (l) => l.hash });

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    if (!id) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";

    let cancelled = false;
    const start = performance.now();
    const MAX_MS = 800;

    const tick = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior, block: "start" });
        return;
      }
      if (performance.now() - start < MAX_MS) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [hash]);
}