import { expect, test } from "@playwright/test"

test("shows top progress bar while route is pending", async ({ page }) => {
  let delayedFlightRequestSeen = false

  await page.route("**/*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = request.headers()
    const isAboutRoute = url.pathname === "/en/about"
    const isPrefetch =
      headers["next-router-prefetch"] === "1" ||
      headers["purpose"] === "prefetch"

    if (!isAboutRoute) {
      await route.continue()
      return
    }

    if (isPrefetch) {
      await route.abort()
      return
    }

    if (headers["rsc"] !== undefined && !delayedFlightRequestSeen) {
      delayedFlightRequestSeen = true
      await page.waitForTimeout(650)
    }

    await route.continue()
  })

  await page.goto("/en")
  await page.locator("a[href='/en/about']").first().click()

  await expect(page.getByTestId("route-top-progress")).toBeVisible()
  await expect(page).toHaveURL(/\/en\/about$/)
  expect(delayedFlightRequestSeen).toBe(true)
})
