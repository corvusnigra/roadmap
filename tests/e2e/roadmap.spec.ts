import { test, expect } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";

const TEST_EMAIL = "e2e-tester@example.com";

test.describe("/roles/frontend-developer", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("renders the canvas with the seeded nodes", async ({ page }) => {
    await page.goto("/roles/frontend-developer");
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible();
    await expect(page.locator("[data-node-slug]")).toHaveCount(5);
    await expect(page.getByTestId("progress-text")).toHaveText(/0 of 5 mastered/);
  });

  test("clicking a locked node surfaces an unmet-prerequisite toast", async ({
    page,
  }) => {
    await page.goto("/roles/frontend-developer");
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible();

    // html-document-structure has how-the-web-works as an unmet prereq.
    await page.locator('[data-node-slug="html-document-structure"]').click();

    // Sonner mounts toasts inside an aria-region. Disambiguate from the
    // "Locked" badge text that decorates all locked roadmap nodes by
    // scoping the assertion to the notifications region.
    const toastRegion = page.getByRole("region", { name: /notifications/i });
    await expect(toastRegion.getByText("Locked", { exact: true })).toBeVisible();
    await expect(
      toastRegion.getByText(/How the Web Works/, { exact: false }),
    ).toBeVisible();
  });

  test("clicking an available node navigates to its node page", async ({
    page,
  }) => {
    await page.goto("/roles/frontend-developer");
    await expect(page.getByTestId("roadmap-canvas")).toBeVisible();

    // how-the-web-works has no prerequisites; isNodeUnlocked() returns true.
    await page.locator('[data-node-slug="how-the-web-works"]').click();
    await page.waitForURL("**/roles/frontend-developer/nodes/how-the-web-works");
    await expect(page).toHaveURL(
      /\/roles\/frontend-developer\/nodes\/how-the-web-works$/,
    );
  });
});
