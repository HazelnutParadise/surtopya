import { expect, test } from "@playwright/test"

test("legacy survey preview route redirects to create preview", async ({ page }) => {
  await page.goto("/en/survey/preview")
  await expect(page).toHaveURL(/\/en\/create\/preview$/)
  await expect(page.getByRole("heading", { name: "No Preview Data" })).toBeVisible()
})
