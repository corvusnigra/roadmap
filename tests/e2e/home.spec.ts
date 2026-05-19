import { expect, test } from "@playwright/test";

test("home page renders the MVP heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "RoleRoadmap MVP" })).toBeVisible();
});
