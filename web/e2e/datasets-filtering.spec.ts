import { test, expect } from "@playwright/test"

test("datasets filtering (category + search) updates API query and rendered cards (mocked)", async ({
  page,
}) => {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1 }),
    })
  })

  const queries: string[] = []

  await page.route("**/api/datasets?*", async (route) => {
    const url = new URL(route.request().url())
    queries.push(url.searchParams.toString())

    const category = url.searchParams.get("category") || ""
    const search = url.searchParams.get("search") || ""
    const offset = Number(url.searchParams.get("offset") || "0")
    const limit = Number(url.searchParams.get("limit") || "6")

    const mk = (id: string) => ({
      id,
      title: `Dataset ${id}`,
      description: `Dataset ${id} desc`,
      category: category || "technology",
      accessType: "free",
      price: 0,
      downloadCount: 0,
      sampleSize: 1,
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    })

    // Default page
    if (!category && !search) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          datasets: [mk("default")],
          meta: { limit, offset },
        }),
      })
      return
    }

    // Filtered: search=alpha + category=technology
    if (category === "technology" && search === "alpha") {
      const page0 = Array.from({ length: limit }).map((_, i) =>
        mk(`alpha-${i + 1}`)
      )
      const items = offset === 0 ? page0 : [mk("alpha-7")]
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          datasets: items,
          meta: { limit, offset },
        }),
      })
      return
    }

    // Any other filter: empty result
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        datasets: [],
        meta: { limit, offset },
      }),
    })
  })

  await page.goto("/en/datasets")
  await expect(page.getByTestId("dataset-card-default")).toBeVisible()

  // Set search to "alpha" and select category "technology".
  await page.getByTestId("datasets-search").fill("alpha")
  await page.getByTestId("datasets-category-technology").click()

  await expect(page.getByTestId("dataset-card-alpha-1")).toBeVisible()
  await expect(page.getByTestId("datasets-load-more")).toBeVisible()
  expect(
    queries.some(
      (q) => q.includes("category=technology") && q.includes("search=alpha")
    )
  ).toBeTruthy()

  // Load more with same filters should request offset=6 (second page) and append.
  await page.getByTestId("datasets-load-more").click()
  await expect(page.getByTestId("dataset-card-alpha-7")).toBeVisible()
  expect(queries.some((q) => q.includes("offset=6"))).toBeTruthy()
})
