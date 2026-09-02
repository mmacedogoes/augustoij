/**
 * Cliente Asaas — ambiente selecionável por `ASAAS_ENV`.
 *
 * Server-only. Nunca importe este arquivo em código de cliente.
 * `ASAAS_ENV` = `production` → usa `ASAAS_API_KEY_PRODUCAO` + api.asaas.com
 * `ASAAS_ENV` = `sandbox` (padrão) → usa `ASAAS_API_KEY_SANDBOX` + api-sandbox.asaas.com
 */

import { apenasDigitos } from "./formatters";

export type AsaasEnv = "production" | "sandbox";

export function getAsaasEnv(): AsaasEnv {
  const raw = (process.env.ASAAS_ENV ?? "sandbox").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  if (raw === "sandbox" || raw === "" ) return "sandbox";
  throw new Error(
    `ASAAS_ENV inválido: "${raw}". Use "production" ou "sandbox".`,
  );
}

function getBaseUrl(env: AsaasEnv): string {
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function getApiKey(): string {
  const env = getAsaasEnv();
  const name = env === "production" ? "ASAAS_API_KEY_PRODUCAO" : "ASAAS_API_KEY_SANDBOX";
  const key = process.env[name];
  if (!key) {
    throw new Error(
      `${name} não configurada. Adicione o secret correspondente ao ambiente "${env}".`,
    );
  }
  return key;
}

async function asaasFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const { method = "GET", body, query } = init;
  const qs = query
    ? "?" + new URLSearchParams(query).toString()
    : "";
  const baseUrl = getBaseUrl(getAsaasEnv());
  const res = await fetch(`${baseUrl}${path}${qs}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: getApiKey(),
      "User-Agent": "AugustoIJ/1.0 (Lovable)",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? (safeJson(text) as unknown) : null;

  if (!res.ok) {
    const detail = extractErrorMessage(data) ?? text ?? res.statusText;
    throw new Error(`Asaas ${res.status}: ${detail}`);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { errors?: Array<{ description?: string }>; message?: string };
  if (Array.isArray(d.errors) && d.errors.length > 0) {
    return d.errors.map((e) => e.description ?? "").filter(Boolean).join("; ");
  }
  return d.message ?? null;
}

// ============================================================
// Tipos
// ============================================================

export type AsaasBillingType = "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
export type AsaasCycle = "MONTHLY" | "YEARLY";

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string | null;
  mobilePhone?: string | null;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: string;
  billingType: string;
  nextDueDate: string;
};

export type AsaasPayment = {
  id: string;
  subscription?: string;
  customer: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

// ============================================================
// Customers
// ============================================================

export async function findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const cpfLimpo = apenasDigitos(cpfCnpj);
  if (!cpfLimpo) return null;
  const data = await asaasFetch<{ data: AsaasCustomer[] }>(`/customers`, {
    query: { cpfCnpj: cpfLimpo, limit: "1" },
  });
  return data.data?.[0] ?? null;
}

export async function createCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string | null;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers`, {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: apenasDigitos(input.cpfCnpj),
      mobilePhone: input.mobilePhone ?? undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    },
  });
}

export async function ensureCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string | null;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  const existing = await findCustomerByCpfCnpj(input.cpfCnpj);
  if (existing) return existing;
  return createCustomer(input);
}

// ============================================================
// Subscriptions
// ============================================================

export async function createSubscription(input: {
  customerId: string;
  value: number;
  cycle: AsaasCycle;
  billingType: AsaasBillingType;
  nextDueDate: string; // YYYY-MM-DD
  description: string;
  externalReference?: string;
  callbackUrl?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions`, {
    method: "POST",
    body: {
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      cycle: input.cycle,
      nextDueDate: input.nextDueDate,
      description: input.description,
      externalReference: input.externalReference,
      callback: input.callbackUrl
        ? { successUrl: input.callbackUrl, autoRedirect: true }
        : undefined,
    },
  });
}

export async function getFirstPaymentOfSubscription(
  subscriptionId: string,
): Promise<AsaasPayment | null> {
  const data = await asaasFetch<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments`,
    { query: { limit: "1" } },
  );
  return data.data?.[0] ?? null;
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

export async function getSubscription(subscriptionId: string): Promise<
  AsaasSubscription & { nextDueDate: string; deleted?: boolean }
> {
  return asaasFetch(`/subscriptions/${subscriptionId}`);
}

/**
 * Helper: data no formato YYYY-MM-DD para "amanhã" no fuso America/Sao_Paulo.
 * Asaas exige que `nextDueDate` seja no futuro.
 */
export function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}