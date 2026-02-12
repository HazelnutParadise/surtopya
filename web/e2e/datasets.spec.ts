import { test, expect } from "@playwright/test"

test("datasets page renders datasets from API (mocked)", async ({ page }) => {
  await page.route("**/api/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        datasets: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            title: "Mock Dataset",
            description: "Mock dataset description",
            category: "technology",
            accessType: "free",
            price: 0,
            downloadCount: 3,
            sampleSize: 12,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        meta: { limit: 6, offset: 0 },
      }),
    })
  })

  await page.goto("/zh-TW/datasets")
  // The dataset card repeats title text in multiple nodes; avoid strict-mode ambiguity.
  await expect(page.getByText("Mock Dataset").first()).toBeVisible()
})
