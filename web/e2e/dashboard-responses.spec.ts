import { test, expect } from "@playwright/test"

test("dashboard survey detail renders responses list (mocked)", async ({
  page,
}) => {
  const surveyId = "11111111-1111-1111-1111-111111111111"

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "me",
        email: "me@example.com",
        displayName: "Me",
        pointsBalance: 0,
        isPro: false,
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
        title: "My Survey",
        description: "desc",
        visibility: "public",
        isPublished: true,
        includeInDatasets: true,
        everPublic: true,
        publishedCount: 1,
        theme: { primaryColor: "#7c3aed", backgroundColor: "#ffffff", fontFamily: "inter" },
        pointsReward: 9,
        expiresAt: null,
        responseCount: 2,
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
      body: JSON.stringify({
        responses: [
          {
            id: "r-1",
            surveyId,
            userId: "u-1",
            status: "completed",
            pointsAwarded: 6,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          {
            id: "r-2",
            surveyId,
            anonymousId: "anon",
            status: "in_progress",
            pointsAwarded: 0,
            startedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  await page.goto(`/en/dashboard/surveys/${surveyId}`)

  const table = page.getByTestId("dashboard-responses-table")
  await expect(table).toBeVisible()
  await expect(page.getByText("Completed")).toBeVisible()
  await expect(page.getByText("In progress")).toBeVisible()
  await expect(table.getByRole("cell", { name: "6", exact: true })).toBeVisible()
})
