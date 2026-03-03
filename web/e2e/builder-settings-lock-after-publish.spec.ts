import { test, expect } from "@playwright/test"

test("builder settings lock visibility + dataset sharing after first publish", async ({
  page,
}) => {
  const surveyId = "55555555-5555-5555-5555-555555555555"

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
        description: "desc",
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

  await page.goto(`/en/create?edit=${surveyId}`)

  await expect(page.getByText("Data Usage Consent")).toBeVisible()
  await page.getByRole("button", { name: "I Understand and Agree" }).click()

  await page.getByTestId("builder-tab-settings").click()

  await expect(page.getByTestId("builder-settings-visibility-public")).toBeDisabled()
  await expect(page.getByTestId("builder-settings-visibility-nonpublic")).toBeDisabled()
  await expect(page.getByTestId("builder-settings-include-in-datasets")).toBeDisabled()
  await expect(page.getByTestId("builder-settings-publish-locked-hint")).toBeVisible()
})
