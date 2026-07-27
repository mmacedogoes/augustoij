import { createFileRoute } from "@tanstack/react-router";
import { PLANOS } from "@/config/planos";

// Rota temporária de teste — remover após validação.
export const Route = createFileRoute("/api/public/test-asaas-precos")({
  server: {
    handlers: {
      GET: async () => {
        const asaas = await import("@/lib/asaas.server");
        const env = asaas.getAsaasEnv();
        const base =
          env === "production"
            ? "https://api.asaas.com/v3"
            : "https://api-sandbox.asaas.com/v3";
        const key =
          env === "production"
            ? process.env.ASAAS_API_KEY_PRODUCAO
            : process.env.ASAAS_API_KEY_SANDBOX;
        if (!key) return Response.json({ error: "sem chave Asaas" }, { status: 500 });

        const headers = {
          "access_token": key,
          "Content-Type": "application/json",
        };

        // cria customer descartável
        const cRes = await fetch(`${base}/customers`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "TESTE PRECOS AIJ",
            cpfCnpj: "24971563792",
            email: `teste-precos+${Date.now()}@example.com`,
          }),
        });
        const cJson = (await cRes.json()) as { id?: string; errors?: unknown };
        if (!cJson.id) return Response.json({ step: "customer", cJson }, { status: 500 });
        const customerId = cJson.id;

        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const planos = ["essencial", "profissional", "gestao", "administradora"] as const;
        const ciclos = ["mensal", "anual"] as const;

        const results: Array<Record<string, unknown>> = [];
        for (const p of planos) {
          for (const c of ciclos) {
            const esperado =
              c === "anual" ? PLANOS[p].precoAnual : PLANOS[p].precoMensal;
            const cycle = c === "anual" ? "YEARLY" : "MONTHLY";
            const sRes = await fetch(`${base}/subscriptions`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                customer: customerId,
                billingType: "UNDEFINED",
                value: esperado,
                cycle,
                nextDueDate: tomorrow,
                description: `TESTE ${p}-${c}`,
              }),
            });
            const sJson = (await sRes.json()) as {
              id?: string;
              value?: number;
              cycle?: string;
              errors?: unknown;
            };
            results.push({
              plano: p,
              ciclo: c,
              esperado,
              asaas_value: sJson.value ?? null,
              asaas_cycle: sJson.cycle ?? null,
              ok: sJson.value === esperado && sJson.cycle === cycle,
              errors: sJson.errors ?? null,
            });
            if (sJson.id) {
              await fetch(`${base}/subscriptions/${sJson.id}`, {
                method: "DELETE",
                headers,
              });
            }
          }
        }

        await fetch(`${base}/customers/${customerId}`, { method: "DELETE", headers });

        return Response.json({ ambiente: env, results });
      },
    },
  },
});