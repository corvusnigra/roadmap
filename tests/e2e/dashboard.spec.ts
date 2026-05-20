import { test, expect } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";

const TEST_EMAIL = "e2e-tester@example.com";

test.describe("/dashboard", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("redirects from / and shows a freshly-reset user's session", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Today's session.
    const session = page.getByTestId("todays-session");
    await expect(session).toBeVisible();
    // DOM concatenates "0" and "cards due" without whitespace because they
    // live in separate <p> tags — match without requiring whitespace.
    await expect(session).toContainText(/0\s*cards?\s+due/i);

    // Recommended next node — `how-the-web-works` has no prereqs and the
    // smallest position_x in the seed, so it always wins after a reset.
    await expect(page.getByTestId("next-node-title")).toHaveText(
      "How the Web Works",
    );

    // Progress ring + numbers.
    const progress = page.getByTestId("progress-card");
    await expect(progress).toBeVisible();
    await expect(page.getByTestId("progress-ring")).toHaveAttribute(
      "data-value",
      "0",
    );
    await expect(page.getByTestId("progress-mastered")).toHaveText("0");
    await expect(page.getByTestId("progress-total")).toHaveText("5");

    // Streak — fresh user has no activity events, so streak is 0.
    await expect(page.getByTestId("streak-count")).toHaveText("0");

    // Sparkline renders (either with empty data or 7 buckets at zero).
    await expect(
      page.getByTestId("sparkline").or(page.getByTestId("sparkline-empty")),
    ).toBeVisible();
  });

  test("'Open next node' navigates to the recommended node", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByTestId("open-next-node").click();
    await page.waitForURL("**/roles/frontend-developer/nodes/how-the-web-works");
    await expect(page).toHaveURL(
      /\/roles\/frontend-developer\/nodes\/how-the-web-works$/,
    );
  });

  test("'Review' link reaches the review queue", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("open-review").click();
    await page.waitForURL("**/review");
    await expect(page).toHaveURL(/\/review$/);
  });
});
