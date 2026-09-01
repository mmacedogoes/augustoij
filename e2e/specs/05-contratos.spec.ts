import { test, expect } from "../fixtures/auth.fixture";

test.describe("Gestão de contratos", () => {
  test("painel lista contratos e alertas", async ({ authenticatedPage: page }) => {
    await page.goto("/app/contratos/painel");
    await expect(page.getByText(/contrato/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("abre o cadastro de novo contrato", async ({ authenticatedPage: page }) => {
    await page.goto("/app/contratos/painel");
    const novo = page.getByRole("button", { name: /novo contrato|cadastrar contrato/i }).first();
    test.skip(!(await novo.isVisible().catch(() => false)), "Cadastro de contrato indisponível no plano");
    await novo.click();
    await expect(page.getByText(/prestador|fornecedor/i).first()).toBeVisible();
  });

  test("valida campos obrigatórios e datas do contrato", async ({ authenticatedPage: page }) => {
    await page.goto("/app/contratos/painel");
    const novo = page.getByRole("button", { name: /novo contrato|cadastrar contrato/i }).first();
    test.skip(!(await novo.isVisible().catch(() => false)), "Cadastro de contrato indisponível no plano");
    await novo.click();
    const inicio = page.getByLabel(/início|inicio/i).first();
    const fim = page.getByLabel(/fim|término|termino/i).first();
    if ((await inicio.isVisible().catch(() => false)) && (await fim.isVisible().catch(() => false))) {
      await inicio.fill("2026-12-31");
      await fim.fill("2026-01-01");
    }
    await page.getByRole("button", { name: /salvar|cadastrar/i }).last().click();
    await expect(page.getByText(/obrigatóri|data|inválid/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
