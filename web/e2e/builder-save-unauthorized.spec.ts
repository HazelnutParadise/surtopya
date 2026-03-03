import { expect, test } from "@playwright/test"

test("builder requires login before creating survey", async ({ page }) => {
  await page.goto("/en/create")

  await expect(page.getByText("Sign in required to create surveys")).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
})
