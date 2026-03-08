import { test, expect } from "@playwright/test"

test("explore shows login required badge for gated surveys", async ({ page }) => {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1 }),
    })
  })

  await page.route("**/api/surveys/public?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        surveys: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Members Only Survey",
            description: "Requires login",
            visibility: "public",
            requireLoginToRespond: true,
            isResponseOpen: true,
            includeInDatasets: true,
            everPublic: true,
            publishedCount: 1,
            pointsReward: 9,
            responseCount: 4,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  await page.goto("/en/explore")

  await expect(page.getByText("Members Only Survey")).toBeVisible()
  await expect(page.getByText("Login Required")).toBeVisible()
})
