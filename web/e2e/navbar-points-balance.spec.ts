import { test, expect } from "@playwright/test"

const buildProfile = (pointsBalance: number) => ({
  id: "me",
  email: "me@example.com",
  displayName: "Me",
  pointsBalance,
  membershipTier: "free",
  capabilities: {},
  isAdmin: false,
  isSuperAdmin: false,
  locale: "en",
  createdAt: new Date().toISOString(),
  surveysCompleted: 0,
})

test("shows points badge on desktop when user is authenticated", async ({ page }) => {
  await page.route("**/api/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildProfile(12345)),
    })
  })

  await page.goto("/en/about")

  const desktopBadge = page.getByTestId("navbar-points-desktop")
  await expect(desktopBadge).toBeVisible()
  await expect(desktopBadge).toContainText("Points Balance")
  await expect(desktopBadge).toContainText("12,345")
})

test("refreshes points badge when route changes", async ({ page }) => {
  let meCalls = 0

  await page.route("**/api/me*", async (route) => {
    meCalls += 1
    const points = meCalls === 1 ? 10 : 20
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildProfile(points)),
    })
  })

  await page.route("**/api/pricing/plans*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plans: [] }),
    })
  })

  await page.goto("/en/about")
  await expect(page.getByTestId("navbar-points-desktop")).toContainText("10")

  await page.getByRole("link", { name: "Pricing" }).click()
  await expect(page).toHaveURL(/\/en\/pricing/)

  await expect(page.getByTestId("navbar-points-desktop")).toContainText("20")
})

test("refreshes points badge on focus and visibilitychange", async ({ page }) => {
  let meCalls = 0

  await page.route("**/api/me*", async (route) => {
    meCalls += 1
    const points = meCalls === 1 ? 100 : meCalls === 2 ? 200 : 300
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildProfile(points)),
    })
  })

  await page.goto("/en/about")
  await expect(page.getByTestId("navbar-points-desktop")).toContainText("100")

  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"))
  })
  await expect(page.getByTestId("navbar-points-desktop")).toContainText("200")

  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.getByTestId("navbar-points-desktop")).toContainText("300")
})

test("does not show points badge when unauthenticated", async ({ page }) => {
  await page.route("**/api/me*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    })
  })

  await page.goto("/en/about")

  await expect(page.getByTestId("navbar-points-desktop")).toHaveCount(0)
  await expect(page.getByTestId("navbar-points-mobile")).toHaveCount(0)
})

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("shows compact points badge in mobile header", async ({ page }) => {
    await page.route("**/api/me*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildProfile(88)),
      })
    })

    await page.goto("/en/about")

    const mobileBadge = page.getByTestId("navbar-points-mobile")
    await expect(mobileBadge).toBeVisible()
    await expect(mobileBadge).toContainText("88")
  })
})
