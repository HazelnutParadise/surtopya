import { test, expect } from "@playwright/test"

test("explore load more appends additional surveys (mocked)", async ({
  page,
}) => {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1 }),
    })
  })

  await page.route("**/api/surveys/public?*", async (route) => {
    const url = new URL(route.request().url())
    const offset = Number(url.searchParams.get("offset") || "0")
    const limit = Number(url.searchParams.get("limit") || "24")

    const mk = (id: string) => ({
      id,
      title: `Survey ${id}`,
      description: `Survey ${id} desc`,
      visibility: "public",
      isPublished: true,
      includeInDatasets: true,
      everPublic: true,
      publishedCount: 1,
      pointsReward: 0,
      responseCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Ensure hasMore on first page by returning exactly `limit` items.
    if (offset === 0) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          surveys: Array.from({ length: limit }).map((_, i) => mk(`p0-${i + 1}`)),
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        surveys: [mk("p1-1")],
      }),
    })
  })

  await page.goto("/en/explore")

  await expect(page.getByTestId("survey-card-p0-1")).toBeVisible()
  await expect(page.getByTestId("explore-load-more")).toBeVisible()

  await page.getByTestId("explore-load-more").click()
  await expect(page.getByTestId("survey-card-p1-1")).toBeVisible()
})

