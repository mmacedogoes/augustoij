import { test as base, expect, type Page } from "@playwright/test";
import {
  MOCK_ADMIN,
  MOCK_USER,
  STORAGE_KEY,
  mockChat,
  mockRotasAuxiliares,
  mockSupabaseAuth,
  mockSupabaseRest,
} from "../helpers/supabase-mock";

function sessao(user: typeof MOCK_USER) {
  return {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user,
  };
}

/** Injeta a sessão do Supabase no localStorage e nos cookies antes da navegação. */
export async function autenticar(page: Page, user = MOCK_USER) {
  const s = sessao(user);
  const baseUrl = new URL(page.context().browser() ? "http://localhost" : "http://localhost");
  void baseUrl;
  await page.context().addCookies([
    {
      name: STORAGE_KEY,
      value: encodeURIComponent(JSON.stringify(s)),
      url: process.env["PLAYWRIGHT_TEST_BASE_URL"] ?? "http://localhost:8080",
    },
  ]);
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [STORAGE_KEY, JSON.stringify(s)],
  );
}

type Fixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await mockSupabaseAuth(page);
    await mockSupabaseRest(page);
    await mockChat(page);
    await mockRotasAuxiliares(page);
    await autenticar(page, MOCK_USER);
    await use(page);
  },
  adminPage: async ({ page }, use) => {
    await mockSupabaseAuth(page, { admin: true });
    await mockSupabaseRest(page, {
      profiles: [
        {
          id: MOCK_ADMIN.id,
          nome: "Admin Teste",
          email: MOCK_ADMIN.email,
          onboarding_completo: true,
          onboarding_tour_completo: true,
          dicas_ativas: false,
          papel_sistema: "super_admin",
          perfil_atuacao: "advogado",
        },
      ],
    });
    await mockChat(page);
    await mockRotasAuxiliares(page);
    await autenticar(page, MOCK_ADMIN);
    await use(page);
  },
});

export { expect };
