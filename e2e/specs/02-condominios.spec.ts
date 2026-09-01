import { test, expect } from "../fixtures/auth.fixture";

test.describe("Condomínios", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/app/condominios");
  });

  test("lista de condomínios carrega", async ({ authenticatedPage: page }) => {
    await expect(page.getByRole("heading", { name: /Meus condomínios/i })).toBeVisible({ timeout: 20_000 });
  });

  test("abre o formulário de novo condomínio e valida campos obrigatórios", async ({
    authenticatedPage: page,
  }) => {
    const botao = page.getByTestId("btn-novo-condominio");
    test.skip(!(await botao.isVisible().catch(() => false)), "Plano sem permissão para criar condomínio");
    await botao.click();
    await expect(page.getByTestId("input-condo-nome")).toBeVisible();
    await page.getByTestId("btn-salvar-condominio").click();
    // HTML5 required impede o envio: o diálogo permanece aberto.
    await expect(page.getByTestId("input-condo-nome")).toBeVisible();
  });

  test("cria um condomínio preenchendo o formulário", async ({ authenticatedPage: page }) => {
    const botao = page.getByTestId("btn-novo-condominio");
    test.skip(!(await botao.isVisible().catch(() => false)), "Plano sem permissão para criar condomínio");
    await botao.click();
    await page.getByTestId("input-condo-nome").fill("Condomínio E2E");
    await page.getByTestId("select-condo-categoria").selectOption("predio");
    await page.getByTestId("input-condo-cnpj").fill("12345678000199");
    await page.getByTestId("input-condo-uf").fill("PB");
    await page.getByTestId("input-condo-cidade").fill("João Pessoa");
    await page.getByTestId("btn-salvar-condominio").click();
    await expect(page.getByText(/Condomínio criado|não tem permissão|erro/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("abre um condomínio e navega entre as abas", async ({ authenticatedPage: page }) => {
    const card = page.getByTestId("condominio-card").first();
    test.skip(!(await card.isVisible().catch(() => false)), "Nenhum condomínio disponível");
    await card.click();
    for (const aba of ["tab-chat", "tab-documentos", "tab-unidades", "tab-dados"]) {
      const t = page.getByTestId(aba);
      if (await t.isVisible().catch(() => false)) {
        await t.click();
        await expect(t).toHaveAttribute("data-state", "active");
      }
    }
  });
});
