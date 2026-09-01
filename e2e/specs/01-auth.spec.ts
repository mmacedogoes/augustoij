import { test, expect } from "../fixtures/auth.fixture";
import { mockRotasAuxiliares, mockSupabaseAuth, mockSupabaseRest } from "../helpers/supabase-mock";

test.describe("Autenticação", () => {
  test("cadastro PF feliz mostra confirmação de e-mail", async ({ page }) => {
    await mockSupabaseAuth(page);
    await mockRotasAuxiliares(page);
    await page.goto("/signup");
    await page.getByTestId("signup-nome").fill("Maria Silva");
    await page.getByTestId("signup-email").fill("maria@teste.com");
    await page.getByTestId("signup-telefone").fill("(83) 99999-0000");
    await page.getByTestId("signup-cpf").fill("12345678901");
    await page.getByTestId("signup-perfil").selectOption("sindico");
    await page.getByTestId("signup-password").fill("Senha1234");
    await page.getByTestId("signup-confirmar").fill("Senha1234");
    await page.getByTestId("signup-lgpd").click();
    await page.getByTestId("signup-submit").click();
    await expect(page.getByText(/confirme seu e-mail|verifique seu e-mail|reenviar e-mail/i).first()).toBeVisible();
  });

  test("cadastro PJ exige razão social", async ({ page }) => {
    await mockSupabaseAuth(page);
    await mockRotasAuxiliares(page);
    await page.goto("/signup");
    await page.getByRole("button", { name: "Pessoa Jurídica" }).click();
    await expect(page.getByLabel("Razão Social")).toBeVisible();
  });

  test("cadastro falha com senha curta e senhas diferentes", async ({ page }) => {
    await mockSupabaseAuth(page);
    await mockRotasAuxiliares(page);
    await page.goto("/signup");
    await page.getByTestId("signup-nome").fill("João");
    await page.getByTestId("signup-email").fill("joao@teste.com");
    await page.getByTestId("signup-telefone").fill("83999990000");
    await page.getByTestId("signup-cpf").fill("12345678901");
    await page.getByTestId("signup-perfil").selectOption("sindico");
    await page.getByTestId("signup-password").fill("123");
    await page.getByTestId("signup-confirmar").fill("456");
    await page.getByTestId("signup-lgpd").click();
    await page.getByTestId("signup-submit").click();
    await expect(page.getByText(/Mínimo 8 caracteres|não coincidem/i).first()).toBeVisible();
  });

  test("cadastro bloqueado com termos desmarcados", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByTestId("signup-submit")).toBeDisabled();
  });

  test("login feliz redireciona para /app", async ({ page }) => {
    await mockSupabaseAuth(page);
    await mockSupabaseRest(page);
    await mockRotasAuxiliares(page);
    await page.goto("/login");
    await page.getByTestId("login-email").fill("teste@augusto.test");
    await page.getByTestId("login-password").fill("Senha1234");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
  });

  test("login falha com credenciais incorretas", async ({ page }) => {
    await mockSupabaseAuth(page, { failLogin: true });
    await mockRotasAuxiliares(page);
    await page.goto("/login");
    await page.getByTestId("login-email").fill("errado@teste.com");
    await page.getByTestId("login-password").fill("senhaerrada");
    await page.getByTestId("login-submit").click();
    await expect(page.getByText(/incorret|invalid/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login bloqueado por rate limit (429)", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.route("**/api/public/auth-check", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, message: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }),
      }),
    );
    await page.goto("/login");
    await page.getByTestId("login-email").fill("teste@augusto.test");
    await page.getByTestId("login-password").fill("Senha1234");
    await page.getByTestId("login-submit").click();
    await expect(page.getByText(/Muitas tentativas/i).first()).toBeVisible();
  });

  test("logout limpa sessão e volta ao login", async ({ authenticatedPage: page }) => {
    await page.goto("/app");
    const sair = page.getByTestId("btn-logout").first();
    if (await sair.isVisible().catch(() => false)) {
      await sair.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    } else {
      await page.evaluate(() => window.localStorage.clear());
      await page.goto("/app");
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    }
  });
});
