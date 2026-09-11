import { createFileRoute } from "@tanstack/react-router";
import { APP_BUILD_TIME } from "@/lib/versao";

// Endereço simples para conferir qual build está no ar.
export const Route = createFileRoute("/api/public/versao")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { build: APP_BUILD_TIME },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
