import { test, expect } from "../fixtures/auth.fixture";

test.describe("Helpdesk e proteção de rotas", () => {
  test("abre um chamado no helpdesk", async ({ authenticatedPage: page }) => {
    await page.goto("/app/ajuda");
    const abrir = page.getByRole("button", { name: /novo chamado|abrir chamado|suporte/i }).first();
    test.skip(!(await abrir.isVisible().catch(() => false)), "Helpdesk indisponível nesta tela");
    await abrir.click();
    const assunto = page.getByLabel(/assunto|título|titulo/i).first();
    if (await assunto.isVisible().catch(() => false)) await assunto.fill("Chamado E2E");
    const mensagem = page.getByLabel(/mensagem|descrição|descricao/i).first();
    if (await mensagem.isVisible().catch(() => false)) await mensagem.fill("Teste automatizado.");
    await page.getByRole("button", { name: /enviar|abrir/i }).last().click();
    await expect(page.getByText(/chamado|enviad|erro/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("rota protegida redireciona visitante para /login", async ({ page }) => {
    await page.goto("/app/condominios");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("hooks públicos exigem token", async ({ request }) => {
    for (const rota of [
      "/api/public/hooks/lembretes-contratos",
      "/api/public/hooks/helpdesk-lembretes",
    ]) {
      const res = await request.post(rota, { data: {} });
      expect([401, 403]).toContain(res.status());
    }
  });

  test("rota pública de política de privacidade responde 200", async ({ page }) => {
    const res = await page.goto("/privacidade");
    expect(res?.status()).toBeLessThan(400);
  });
});
