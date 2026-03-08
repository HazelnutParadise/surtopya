import { test, expect } from "@playwright/test"

test("thank-you page lets guests forfeit anonymous points", async ({ page }) => {
  await page.route("**/api/me?optional=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    })
  })

  await page.route("**/api/responses/forfeit-anonymous-points", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "forfeited" }),
    })
  })

  await page.addInitScript(() => {
    const claim = {
      responseId: "r1",
      claimToken: "token-1",
      pointsAwarded: 9,
      expiresAt: "2026-03-08T00:00:00.000Z",
      status: "pending",
    }
    window.sessionStorage.setItem("surtopya:anonymous_claim:r1", JSON.stringify(claim))
    window.sessionStorage.setItem("surtopya:anonymous_claim:active", "r1")
  })

  await page.goto("/en/survey/thank-you?points=9")

  await expect(page.getByText("Claim your points")).toBeVisible()
  await page.getByRole("button", { name: "Forfeit points" }).click()
  await expect(page.getByText("You chose not to claim these points.")).toBeVisible()
})

test("thank-you page auto-claims anonymous points after sign-in", async ({ page }) => {
  await page.route("**/api/me?optional=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "me",
        email: "me@example.com",
        displayName: "Me",
        pointsBalance: 0,
        membershipTier: "free",
        capabilities: {},
        isAdmin: false,
        isSuperAdmin: false,
        locale: "en",
        createdAt: new Date().toISOString(),
        surveysCompleted: 0,
      }),
    })
  })

  await page.route("**/api/responses/claim-anonymous-points", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pointsAwarded: 9, status: "claimed" }),
    })
  })

  await page.addInitScript(() => {
    const claim = {
      responseId: "r2",
      claimToken: "token-2",
      pointsAwarded: 9,
      expiresAt: "2026-03-08T00:00:00.000Z",
      status: "pending",
    }
    window.sessionStorage.setItem("surtopya:anonymous_claim:r2", JSON.stringify(claim))
    window.sessionStorage.setItem("surtopya:anonymous_claim:active", "r2")
  })

  await page.goto("/en/survey/thank-you?points=9")

  await expect(page.getByText("Points were added to your account.")).toBeVisible()
})
