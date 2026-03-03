import { test, expect } from "@playwright/test"

test("datasets supports sort and pagination (mocked)", async ({ page }) => {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1 }),
    })
  })

  const requests: string[] = []

  await page.route("**/api/datasets?*", async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.searchParams.toString())

    const sort = url.searchParams.get("sort") || "newest"
    const offset = Number(url.searchParams.get("offset") || "0")
    const limit = Number(url.searchParams.get("limit") || "6")

    const mk = (id: string, downloadCount: number, sampleSize: number, createdAt: string) => ({
      id,
      title: `Dataset ${id}`,
      description: `Dataset ${id} desc`,
      category: "technology",
      accessType: "free",
      price: 0,
      downloadCount,
      sampleSize,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    })

    // 2 pages, each with `limit` items.
    // We intentionally return unsorted server data; the UI must render in correct sort order.
    const page0 = [
      mk("a", 1, 10, "2024-01-01T00:00:00.000Z"),
      mk("b", 50, 3, "2024-01-02T00:00:00.000Z"),
      mk("c", 2, 99, "2024-01-03T00:00:00.000Z"),
      mk("d", 10, 4, "2024-01-04T00:00:00.000Z"),
      mk("e", 5, 40, "2024-01-05T00:00:00.000Z"),
      mk("f", 7, 1, "2024-01-06T00:00:00.000Z"),
    ].slice(0, limit)

    const page1 = [
      mk("g", 100, 2, "2024-01-07T00:00:00.000Z"),
      mk("h", 0, 200, "2024-01-08T00:00:00.000Z"),
      mk("i", 9, 9, "2024-01-09T00:00:00.000Z"),
      mk("j", 3, 3, "2024-01-10T00:00:00.000Z"),
      mk("k", 4, 4, "2024-01-11T00:00:00.000Z"),
      mk("l", 8, 8, "2024-01-12T00:00:00.000Z"),
    ].slice(0, limit)

    const items = offset === 0 ? page0 : page1

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        datasets: items,
        meta: { limit, offset },
        sort,
      }),
    })
  })

  await page.goto("/en/datasets")

  // Page 0 loaded.
  await expect(page.getByTestId("dataset-card-a")).toBeVisible()
  await expect(page.getByTestId("datasets-load-more")).toBeVisible()

  // Switch sort to downloads. Highest downloads in page0 is "b".
  await page.getByTestId("datasets-sort").click()
  await page.getByRole("option", { name: "Most Downloads" }).click()
  await expect(page.getByTestId("dataset-card-b")).toBeVisible()

  // Pagination: load more appends page1 datasets.
  await page.getByTestId("datasets-load-more").click()
  await expect(page.getByTestId("dataset-card-g")).toBeVisible()

  // Verify we did request offset=6 at least once.
  expect(requests.some((q) => q.includes("offset=6"))).toBeTruthy()
})
