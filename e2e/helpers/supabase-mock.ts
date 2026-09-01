import type { Page, Route } from "@playwright/test";

/**
 * Interceptadores de rede para tornar a suíte E2E hermética:
 * nada sai para a internet, nenhuma cota de IA é consumida e o
 * resultado não depende do estado do banco.
 */

export const PROJECT_REF = process.env["PLAYWRIGHT_SUPABASE_REF"] ?? "pcmptbflyagxycqvvdvd";
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

export const MOCK_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "teste@augusto.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: { nome: "Usuário Teste" },
  created_at: new Date(0).toISOString(),
};

export const MOCK_ADMIN = {
  ...MOCK_USER,
  id: "00000000-0000-4000-8000-0000000000ad",
  email: "admin@augusto.test",
  user_metadata: { nome: "Admin Teste" },
};

export const MOCK_CONDOMINIO = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Residencial Altavista",
  cidade: "João Pessoa",
  uf: "PB",
  cnpj: null,
  qtd_unidades: 56,
  categoria: "predio",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

type Perfil = { admin?: boolean };

/** Mocka /auth/v1/* — sessão, perfil do usuário, login e cadastro. */
export async function mockSupabaseAuth(page: Page, opts: Perfil & { failLogin?: boolean } = {}) {
  const user = opts.admin ? MOCK_ADMIN : MOCK_USER;
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/token")) {
      if (opts.failLogin) {
        return json(route, { error: "invalid_grant", error_description: "Invalid login credentials" }, 400);
      }
      return json(route, {
        access_token: "mock-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "mock-refresh-token",
        user,
      });
    }
    if (url.includes("/signup")) return json(route, { user, session: null });
    if (url.includes("/logout")) return json(route, {}, 204);
    if (url.includes("/user")) return json(route, user);
    return json(route, {});
  });
}

/** Mocka a Data API (/rest/v1/*) com linhas mínimas e coerentes. */
export async function mockSupabaseRest(page: Page, overrides: Record<string, unknown> = {}) {
  const tabelas: Record<string, unknown> = {
    profiles: [
      {
        id: MOCK_USER.id,
        nome: "Usuário Teste",
        email: MOCK_USER.email,
        onboarding_completo: true,
        onboarding_tour_completo: true,
        dicas_ativas: false,
        papel_sistema: null,
        perfil_atuacao: "sindico",
      },
    ],
    condominios: [MOCK_CONDOMINIO],
    unidades: [],
    assembleias: [],
    contratos_servico: [],
    helpdesk_tickets: [],
    ...overrides,
  };

  await page.route("**/rest/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const tabela = pathname.split("/rest/v1/")[1]?.split("?")[0] ?? "";
    if (route.request().method() === "POST" || route.request().method() === "PATCH") {
      return json(route, [{ id: "novo-id" }], 201);
    }
    const linhas = tabelas[tabela];
    return json(route, linhas ?? []);
  });
}

/** Mocka o chat de IA com uma resposta determinística em markdown. */
export async function mockChat(page: Page, opts: { fail?: boolean } = {}) {
  const handler = async (route: Route) => {
    if (opts.fail) return json(route, { error: "Serviço de IA indisponível" }, 503);
    const texto =
      "**Resposta do Augusto**\n\nO condomínio pode aplicar multa nos termos do " +
      "art. 1.336, §1º, do Código Civil.";
    const chunks = [
      `data: ${JSON.stringify({ type: "text-start", id: "1" })}\n\n`,
      `data: ${JSON.stringify({ type: "text-delta", id: "1", delta: texto })}\n\n`,
      `data: ${JSON.stringify({ type: "text-end", id: "1" })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: chunks,
    });
  };
  await page.route("**/api/chat", handler);
  await page.route("**/api/public/demo-chat", handler);
}

/** Mocka as rotas de voz e hooks públicos (nunca chamar de verdade em CI). */
export async function mockRotasAuxiliares(page: Page) {
  await page.route("**/api/voz/**", (route) => json(route, { ok: true, texto: "transcrição simulada" }));
  await page.route("**/api/public/hooks/**", (route) => json(route, { ok: false, error: "unauthorized" }, 401));
  await page.route("**/api/public/auth-check", (route) => json(route, { ok: true }));
}

/** Aplica todos os mocks de uma vez. */
export async function mockTudo(page: Page, opts: Perfil = {}) {
  await mockSupabaseAuth(page, opts);
  await mockSupabaseRest(page);
  await mockChat(page);
  await mockRotasAuxiliares(page);
}
