import { expect, test } from "@playwright/test"

test("home footer legal links navigate to valid pages", async ({ page }) => {
  await page.goto("/en")

  await page.getByRole("link", { name: "Terms of Service" }).click()
  await expect(page).toHaveURL(/\/en\/terms$/)
  await expect(page.getByRole("heading", { name: "Terms of Service Summary" })).toBeVisible()

  await page.goto("/en")
  await page.getByRole("link", { name: "Privacy" }).click()
  await expect(page).toHaveURL(/\/en\/privacy$/)
  await expect(page.getByRole("heading", { name: "Privacy Summary" })).toBeVisible()
})
