import { test, expect } from "../fixtures/auth.fixture";

test.describe("Assembleias e votação", () => {
  test("lista de assembleias carrega", async ({ adminPage: page }) => {
    await page.goto("/app/assembleias");
    await expect(page.getByText(/assembleia/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("formulário de nova assembleia com pauta", async ({ adminPage: page }) => {
    await page.goto("/app/assembleias/nova");
    const titulo = page.getByText(/pauta|dados da assembleia|nova assembleia/i).first();
    await expect(titulo).toBeVisible({ timeout: 20_000 });
  });

  test("cabine de votação rejeita token inválido", async ({ page }) => {
    await page.goto("/cabine/token-invalido-e2e");
    await expect(page.getByText(/inválid|expirad|não encontrad/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
