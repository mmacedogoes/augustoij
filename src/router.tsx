import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega o chunk da rota ao passar o mouse: clique fica instantâneo.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Query owns freshness; keep preload cache warm for 30s to avoid refetch on hover-preload.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
