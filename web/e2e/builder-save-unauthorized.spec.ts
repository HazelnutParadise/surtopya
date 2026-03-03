import { expect, test } from "@playwright/test"

test("builder shows visible auth guidance when saving draft returns 401", async ({ page }) => {
  await page.route("**/api/surveys", async (route) => {
    const req = route.request()
    if (req.method() !== "POST") {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    })
  })

  await page.goto("/en/create")
  await page.getByRole("button", { name: "I Understand and Agree" }).click()
  await expect(page.getByPlaceholder("Untitled Survey")).toBeVisible()

  await page.getByPlaceholder("Untitled Survey").fill("Auth Save Test")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("Please sign in before saving this draft.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Log In" })).toBeVisible()
})
