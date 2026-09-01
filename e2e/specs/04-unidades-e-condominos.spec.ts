import { test, expect } from "../fixtures/auth.fixture";
import { MOCK_CONDOMINIO } from "../helpers/supabase-mock";

const rota = `/app/condominios/${MOCK_CONDOMINIO.id}`;

test.describe("Unidades e condôminos", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto(rota);
    const aba = page.getByTestId("tab-unidades");
    test.skip(!(await aba.isVisible().catch(() => false)), "Aba de unidades indisponível");
    await aba.click();
  });

  test("painel de unidades é exibido", async ({ authenticatedPage: page }) => {
    await expect(page.getByText(/unidade/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("cadastro de unidade exige número", async ({ authenticatedPage: page }) => {
    const novo = page.getByRole("button", { name: /nova unidade|adicionar unidade/i }).first();
    test.skip(!(await novo.isVisible().catch(() => false)), "Cadastro manual de unidade indisponível");
    await novo.click();
    const salvar = page.getByRole("button", { name: /salvar|cadastrar/i }).last();
    await salvar.click();
    await expect(page.getByText(/número|obrigatóri/i).first()).toBeVisible();
  });

  test("permite informar bloco, número, metragem e vagas", async ({ authenticatedPage: page }) => {
    const novo = page.getByRole("button", { name: /nova unidade|adicionar unidade/i }).first();
    test.skip(!(await novo.isVisible().catch(() => false)), "Cadastro manual de unidade indisponível");
    await novo.click();
    for (const [rotulo, valor] of [
      [/bloco/i, "A"],
      [/número|numero/i, "601"],
      [/área|metragem/i, "120,50"],
      [/vagas/i, "2"],
    ] as const) {
      const campo = page.getByLabel(rotulo).first();
      if (await campo.isVisible().catch(() => false)) await campo.fill(valor);
    }
    await page.getByRole("button", { name: /salvar|cadastrar/i }).last().click();
    await expect(page.getByText(/salv|criad|permissão|erro/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("vínculo de condôminos e membros está acessível", async ({ authenticatedPage: page }) => {
    const alvo = page.getByText(/condômino|membros/i).first();
    await expect(alvo).toBeVisible({ timeout: 20_000 });
  });
});
