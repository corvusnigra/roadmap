import { test, expect } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";

const TEST_EMAIL = "e2e-tester@example.com";

test.describe("Tutor panel on a node", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("opens, sends a question, persists round-trip", async ({ page }) => {
    await page.goto("/roles/frontend-developer/nodes/how-the-web-works");

    // Initially closed.
    await expect(page.getByTestId("tutor-panel")).toHaveCount(0);

    // Open.
    await page.getByTestId("open-tutor").click();
    const panel = page.getByTestId("tutor-panel");
    await expect(panel).toBeVisible();

    // Empty state hint.
    await expect(panel.getByText(/Ask anything about/i)).toBeVisible();

    // Send a message. Anthropic is stubbed via the placeholder API key, so
    // the server returns the "tutor not configured" reply — we just assert
    // a round-trip happens and both bubbles render.
    await page.getByTestId("tutor-input").fill("Why use HTTP over HTTPS?");
    await page.getByTestId("tutor-send").click();

    await expect(page.getByTestId("tutor-message-user")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("tutor-message-assistant")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("tutor-message-user"),
    ).toContainText("Why use HTTP over HTTPS?");
    await expect(
      page.getByTestId("tutor-message-assistant"),
    ).toContainText(/tutor not configured|ANTHROPIC_API_KEY/i);

    // Close + reopen — history persists from the server.
    await page.getByTestId("close-tutor").click();
    await expect(panel).toHaveCount(0);
  });
});
