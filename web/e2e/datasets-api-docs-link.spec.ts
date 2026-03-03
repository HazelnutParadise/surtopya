import { expect, test } from "@playwright/test"

test("datasets hero API docs button opens API docs page", async ({ page }) => {
  await page.goto("/en/datasets")

  await page.getByRole("link", { name: "API Documentation" }).first().click()
  await expect(page).toHaveURL(/\/en\/docs\/api$/)
  await expect(page.getByRole("heading", { name: "API Reference" })).toBeVisible()
})
