import { test, expect } from "@playwright/test"

test("dashboard separates created surveys and unfinished drafts into tabs", async ({ page }) => {
  await page.route("**/api/surveys/my", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        surveys: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Created Survey",
            description: "Creator item",
            visibility: "public",
            requireLoginToRespond: false,
            isResponseOpen: true,
            includeInDatasets: true,
            everPublic: true,
            publishedCount: 1,
            pointsReward: 6,
            responseCount: 12,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  await page.route("**/api/drafts/my", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        drafts: [
          {
            id: "d1",
            surveyId: "22222222-2222-2222-2222-222222222222",
            surveyTitle: "Draft Survey",
            surveyVersionId: "v1",
            surveyVersionNumber: 1,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            canResume: true,
          },
        ],
      }),
    })
  })

  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1 }),
    })
  })

  await page.goto("/en/dashboard")

  await expect(page.getByRole("tab", { name: "My Surveys" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "My Drafts" })).toBeVisible()
  await expect(page.getByText("Created Survey")).toBeVisible()
  await expect(page.getByText("Draft Survey")).not.toBeVisible()

  await page.getByRole("tab", { name: "My Drafts" }).click()

  await expect(page.getByText("Draft Survey")).toBeVisible()
  await expect(page.getByText("Created Survey")).not.toBeVisible()
})
