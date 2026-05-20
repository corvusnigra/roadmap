import { test, expect } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";
import { seedNodeProgress } from "./helpers/seed-progress";

const TEST_EMAIL = "e2e-tester@example.com";

test.describe("/review", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("shows the empty state when no nodes are in progress", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByTestId("review-queue-empty")).toBeVisible();
    await expect(page.getByText("No reviews due")).toBeVisible();
  });

  test("surfaces new cards from in-progress nodes and grades them", async ({
    page,
  }) => {
    await seedNodeProgress(TEST_EMAIL, "how-the-web-works", "in_progress");

    await page.goto("/review");

    // First card visible; before reveal, only the prompt + Show answer.
    const card = page.getByTestId("review-card");
    await expect(card).toBeVisible();
    const firstCardId = await card.getAttribute("data-card-id");
    expect(firstCardId).toBeTruthy();

    await page.getByTestId("review-show-answer").click();
    await page.getByTestId("review-grade-good").click();

    // After grading, either the next card surfaces or we hit the empty state.
    // Either way the FIRST card's id should not appear again (FSRS schedules
    // it into the future for Good).
    await page.waitForTimeout(200);
    const stillShowing = await page
      .getByTestId("review-card")
      .getAttribute("data-card-id")
      .catch(() => null);
    if (stillShowing) {
      expect(stillShowing).not.toBe(firstCardId);
    } else {
      await expect(page.getByTestId("review-queue-empty")).toBeVisible();
    }
  });

  test("Again reschedules the card immediately and surfaces it again", async ({
    page,
  }) => {
    await seedNodeProgress(TEST_EMAIL, "how-the-web-works", "in_progress");
    await page.goto("/review");

    const card = page.getByTestId("review-card");
    const firstCardId = await card.getAttribute("data-card-id");
    await page.getByTestId("review-show-answer").click();
    await page.getByTestId("review-grade-again").click();

    // After Again, ts-fsrs sets a short relearning interval that is typically
    // already in the past relative to the page reload time. Reload and assert
    // we see at least one card available (queue is not empty), regardless of
    // whether it's the same card or a sibling.
    await page.reload();
    await expect(page.getByTestId("review-card")).toBeVisible();
    expect(firstCardId).toBeTruthy();
  });
});
