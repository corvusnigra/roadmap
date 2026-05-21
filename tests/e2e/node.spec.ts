import { test, expect, type Page } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";

const TEST_EMAIL = "e2e-tester@example.com";

// Authoritative answer for each mastery-quiz question in the seeded MDX
// `how-the-web-works.mdx`. The dialog picks 5 of these 6 each run; whichever
// 5 it picks, the test looks the answer up by prompt text. Keep this in sync
// with src/content/roles/frontend-developer/how-the-web-works.mdx.
const MASTERY_ANSWERS: Record<string, string> = {
  "Вы набрали `example.com` в браузере — какой шаг произойдёт ПЕРВЫМ?":
    "Браузер выполняет DNS-запрос.",
  "Какой HTTP-метод является идемпотентным И по соглашению не имеет тела запроса?":
    "GET",
  "Ответ со статусом `301` означает…":
    "Ресурс перемещён навсегда — клиентам стоит обновить свои ссылки.",
  "Какая из этих строк является ПЕРВОЙ строкой HTTP-запроса?":
    "GET /index.html HTTP/1.1",
  "Зачем нужен HTTPS вместо HTTP?":
    "End-to-end шифрование и аутентификация сервера через TLS.",
  "Какая группа HTTP-статусов сигнализирует об ошибке сервера?": "5xx",
};

async function answerMasteryQuiz(page: Page) {
  for (let i = 0; i < 5; i++) {
    const question = page.locator(`[data-testid="mastery-question-${i}"]`);
    const rawPrompt = await question.locator("p").first().innerText();
    // Components render "N. <prompt>"; strip the leading numbering.
    const prompt = rawPrompt.replace(/^\d+\.\s+/, "").trim();
    const correctAnswer = MASTERY_ANSWERS[prompt];
    if (!correctAnswer) {
      throw new Error(
        `Test fixture missing mastery answer for prompt: "${prompt}"`,
      );
    }
    await question.getByLabel(correctAnswer, { exact: true }).click();
  }
}

test.describe("/roles/frontend-developer/nodes/how-the-web-works", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("renders all three tabs and the page header", async ({ page }) => {
    await page.goto("/roles/frontend-developer/nodes/how-the-web-works");
    await expect(
      page.getByRole("heading", { name: "Как работает Web" }),
    ).toBeVisible();
    await expect(page.getByTestId("tab-theory")).toBeVisible();
    await expect(page.getByTestId("tab-practice")).toBeVisible();
    await expect(page.getByTestId("tab-reinforcement")).toBeVisible();
    await expect(page.getByTestId("node-status-badge")).toHaveText(/Доступно/);
  });

  test("full mastery flow flips status to mastered and unlocks downstream", async ({
    page,
  }) => {
    await page.goto("/roles/frontend-developer/nodes/how-the-web-works");

    // 1. Theory read
    await page.getByTestId("theory-mark-read").click();
    await expect(page.getByText(/теория отмечена прочитанной/i)).toBeVisible();

    // 2. Practice — answer the seeded MCQ
    await page.getByTestId("tab-practice").click();
    const mcqCard = page.getByTestId("practice-mcq-0");
    await mcqCard.getByLabel("HTTP", { exact: true }).click();
    await page.getByTestId("practice-mcq-0-check").click();
    await expect(mcqCard).toHaveAttribute("data-correct", "true");

    // 3. Mastery quiz
    await page.getByTestId("open-mastery-quiz").click();
    await expect(page.getByTestId("mastery-quiz-dialog")).toBeVisible();
    await answerMasteryQuiz(page);
    await page.getByTestId("mastery-quiz-submit").click();
    await expect(page.getByTestId("mastery-result")).toHaveAttribute(
      "data-passed",
      "true",
    );
    await page.getByTestId("mastery-quiz-close").click();

    // 4. Reinforcement — show answer + grade Good
    await page.getByTestId("tab-reinforcement").click();
    await page.getByTestId("reinforcement-show-answer").click();
    await page.getByTestId("reinforcement-grade-good").click();

    // 5. Badge flips to Mastered
    await expect(page.getByTestId("node-status-badge")).toHaveText(/Освоено/);

    // 6. Back on the canvas, the downstream node is now available.
    await page.goto("/roles/frontend-developer");
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible();
    const downstream = page.locator(
      '[data-node-slug="html-document-structure"]',
    );
    await expect(downstream).toHaveAttribute("data-available", "true");
  });
});
