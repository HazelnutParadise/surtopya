import { test, expect } from "@playwright/test"

test("redirects / to default locale prefix", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/zh-TW(\/|$)/)
})
