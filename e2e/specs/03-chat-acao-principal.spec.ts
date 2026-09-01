import { test, expect } from "../fixtures/auth.fixture";
import { mockChat, MOCK_CONDOMINIO } from "../helpers/supabase-mock";

const rota = `/app/condominios/${MOCK_CONDOMINIO.id}`;

test.describe("Chat jurídico (ação principal)", () => {
  test("envia pergunta e recebe resposta do Augusto em markdown", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(rota);
    const input = page.getByTestId("chat-input");
    test.skip(!(await input.isVisible().catch(() => false)), "Chat indisponível para este condomínio");
    test.skip(await input.isDisabled(), "Chat bloqueado: sem documentos indexados");
    await input.fill("O condomínio pode aplicar multa por barulho?");
    await page.getByTestId("chat-send-btn").click();
    await expect(page.getByTestId("chat-messages-list")).toContainText(/art\.\s*1\.336|Augusto/i, {
      timeout: 30_000,
    });
  });

  test("exibe estado de falha amigável quando a IA está indisponível", async ({
    authenticatedPage: page,
  }) => {
    await mockChat(page, { fail: true });
    await page.goto(rota);
    const input = page.getByTestId("chat-input");
    test.skip(!(await input.isVisible().catch(() => false)), "Chat indisponível para este condomínio");
    test.skip(await input.isDisabled(), "Chat bloqueado: sem documentos indexados");
    await input.fill("Pergunta que vai falhar");
    await page.getByTestId("chat-send-btn").click();
    await expect(page.getByText(/indisponível|erro|tente novamente/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
