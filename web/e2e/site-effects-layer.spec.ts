import { expect, test } from "@playwright/test"

test("renders webgl canvas on target marketing routes", async ({ page }) => {
  const targetRoutes = ["/en/about", "/en/pricing", "/en/terms", "/en/privacy", "/en/explore", "/en/datasets"]

  for (const route of targetRoutes) {
    await page.goto(route)
    await expect(page.getByTestId("site-webgl-canvas")).toBeVisible()
  }
})

test("does not render webgl canvas on excluded routes", async ({ page }) => {
  await page.goto("/en")
  await expect(page.getByTestId("site-webgl-canvas")).toHaveCount(0)

  await page.goto("/en/create")
  await expect(page.getByTestId("site-webgl-canvas")).toHaveCount(0)
})

test("falls back when reduced motion is enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/en/pricing")

  await expect(page.getByTestId("site-effects-fallback")).toBeVisible()
  await expect(page.getByTestId("site-webgl-canvas")).toHaveCount(0)
})

test("background layer does not block key interactions", async ({ page }) => {
  await page.goto("/en")
  await page.locator("a[href='/en/explore']").first().click()
  await expect(page).toHaveURL(/\/en\/explore$/)

  await page.getByTestId("explore-search").fill("privacy")
  await expect(page.getByTestId("explore-search")).toHaveValue("privacy")

  await page.goto("/en/datasets")
  await page.getByTestId("datasets-category-technology").click()
  await expect(page).toHaveURL(/\/en\/datasets\?category=technology$/)

  await page.goto("/en/pricing")
  await page.getByRole("link", { name: /surtopya/i }).first().click()
  await expect(page).toHaveURL(/\/(en|zh-TW|ja)$/)
})
