import { test, expect } from "@playwright/test";

import { resetUserState } from "./helpers/reset-user";

const TEST_EMAIL = "e2e-tester@example.com";

test.describe("Sandpack code exercise on /roles/frontend-developer/nodes/html-semantics", () => {
  test.beforeEach(async () => {
    await resetUserState(TEST_EMAIL);
  });

  test("renders the worked example and fails the starter", async ({ page }) => {
    await page.goto(
      "/roles/frontend-developer/nodes/html-semantics",
    );

    // Switch to Practice tab so the exercise mounts.
    await page.getByTestId("tab-practice").click();

    const exercise = page.getByTestId("code-exercise-1");
    await expect(exercise).toBeVisible();

    // Sandpack needs a moment to spin up its static iframe + bundler. Give it
    // up to ~20s before clicking Run tests.
    const runButton = page.getByTestId("code-exercise-1-run");
    await expect(runButton).toBeEnabled({ timeout: 20_000 });
    await runButton.click();

    // Starter HTML uses non-semantic divs so the assertions throw and
    // tests.js posts a FAIL verdict. The specific message depends on which
    // assertion fires first — assert the FAIL panel + a generic "element"
    // hint (every assertion message contains it).
    const verdictFail = page.getByTestId("code-exercise-1-verdict-fail");
    await expect(verdictFail).toBeVisible({ timeout: 20_000 });
    await expect(verdictFail).toContainText(/element|tag|<header>|landmark|replace/i);

    // The "Take mastery quiz" button stays disabled until the code exercise
    // passes — assert the gate works.
    await expect(page.getByTestId("open-mastery-quiz")).toBeDisabled();
  });
});
