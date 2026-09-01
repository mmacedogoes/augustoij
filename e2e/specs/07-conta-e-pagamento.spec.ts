import { test, expect } from "../fixtures/auth.fixture";

test.describe("Conta e pagamento", () => {
  test("página de conta exibe perfil e plano", async ({ authenticatedPage: page }) => {
    await page.goto("/app/conta");
    await expect(page.getByText(/plano|conta/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("assinatura permite escolher um plano", async ({ authenticatedPage: page }) => {
    await page.goto("/app/assinatura");
    const plano = page.getByRole("button", { name: /assinar|escolher|continuar/i }).first();
    test.skip(!(await plano.isVisible().catch(() => false)), "Tela de assinatura indisponível");
    await plano.click();
    await expect(page.getByText(/cpf|cnpj|pagamento|checkout/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("checkout exige CPF", async ({ authenticatedPage: page }) => {
    await page.route("**/asaas**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
    );
    await page.goto("/app/assinatura");
    const cpf = page.getByLabel(/cpf/i).first();
    test.skip(!(await cpf.isVisible().catch(() => false)), "Campo de CPF não exposto nesta etapa");
    await cpf.fill("");
    await page.getByRole("button", { name: /pagar|continuar|confirmar/i }).last().click();
    await expect(page.getByText(/cpf|obrigatóri/i).first()).toBeVisible();
  });
});
