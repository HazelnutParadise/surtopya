import { test, expect } from "@playwright/test"

test("paid dataset download shows an error on insufficient points (mocked)", async ({
  page,
}) => {
  const id = "44444444-4444-4444-4444-444444444444"
  let postCalls = 0

  await page.route(`**/api/datasets/${id}`, async (route) => {
    const req = route.request()
    if (req.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          title: "Paid Dataset",
          description: "Requires points to download",
          category: "technology",
          accessType: "paid",
          price: 30,
          downloadCount: 0,
          sampleSize: 10,
          isActive: true,
          fileName: "paid.csv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      return
    }

    if (req.method() === "POST") {
      postCalls++
      await route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ error: "Insufficient points" }),
      })
      return
    }

    await route.fallback()
  })

  await page.goto(`/en/datasets/${id}`)
  await expect(page.getByRole("heading", { name: "Paid Dataset" })).toBeVisible()

  await page.getByRole("button", { name: "Download" }).click()

  await expect.poll(() => postCalls).toBe(1)
  await expect(page.getByTestId("dataset-download-error")).toHaveText(
    "Insufficient points"
  )
})
