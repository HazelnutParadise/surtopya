import { test, expect } from "@playwright/test"

test("survey settings lock visibility + dataset sharing after first publish", async ({
  page,
}) => {
  const surveyId = "44444444-4444-4444-4444-444444444444"

  await page.route("**/api/me*", async (route) => {
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

  await page.route(`**/api/surveys/${surveyId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: surveyId,
        userId: "me",
        title: "Published Survey",
        description: "",
        visibility: "non-public",
        isPublished: true,
        includeInDatasets: false,
        everPublic: false,
        publishedCount: 1,
        theme: { primaryColor: "#7c3aed", backgroundColor: "#ffffff", fontFamily: "inter" },
        pointsReward: 0,
        expiresAt: null,
        responseCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        questions: [],
      }),
    })
  })

  await page.route(`**/api/surveys/${surveyId}/responses`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ responses: [] }),
    })
  })

  await page.goto(`/en/dashboard/surveys/${surveyId}`)

  await page.getByRole("tab", { name: /settings/i }).click()

  await expect(page.getByTestId("survey-settings-visibility-public")).toBeDisabled()
  await expect(page.getByTestId("survey-settings-visibility-nonpublic")).toBeDisabled()
  await expect(page.getByTestId("survey-settings-include-in-datasets")).toBeDisabled()
  await expect(page.getByTestId("survey-settings-publish-locked-hint")).toBeVisible()
})
