import { test, expect } from "@playwright/test"

test("dataset detail download triggers a file download (mocked)", async ({
  page,
}) => {
  const id = "22222222-2222-2222-2222-222222222222"

  let postCalls = 0

  await page.route(`**/api/datasets/${id}`, async (route) => {
    const req = route.request()
    if (req.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          title: "Mock Dataset Detail",
          description: "Mock dataset description",
          category: "technology",
          accessType: "free",
          price: 0,
          downloadCount: 3,
          sampleSize: 12,
          isActive: true,
          fileName: "mock.csv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      return
    }

    if (req.method() === "POST") {
      postCalls++
      // Add a tiny delay so the UI has a chance to enter "downloading" state.
      await new Promise((resolve) => setTimeout(resolve, 150))
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition": 'attachment; filename="mock.csv"',
        },
        body: "a,b\n1,2\n",
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/en/datasets/${id}`)

  await expect(
    page.getByRole("heading", { name: "Mock Dataset Detail" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Download" }).click()

  await expect.poll(() => postCalls).toBe(1)
})
