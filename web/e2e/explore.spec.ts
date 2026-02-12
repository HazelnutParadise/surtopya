import { test, expect } from "@playwright/test"

test("explore page renders surveys from API (mocked)", async ({ page }) => {
  await page.route("**/api/surveys/public?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        surveys: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Mock Survey",
            description: "Mock survey description",
            visibility: "public",
            isPublished: true,
            includeInDatasets: true,
            everPublic: true,
            publishedCount: 1,
            pointsReward: 5,
            responseCount: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  await page.goto("/zh-TW/explore")

  // The survey card repeats title text in multiple nodes; avoid strict-mode ambiguity.
  await expect(page.getByText("Mock Survey").first()).toBeVisible()
  await expect(page.getByText("Mock survey description")).toBeVisible()
})
