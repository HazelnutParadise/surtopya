import { test, expect } from "@playwright/test"

test("dataset detail free download triggers a file download (mocked)", async ({
  page,
}) => {
  const id = "d-free"

  await page.route(`**/api/datasets/${id}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          title: "Free Dataset",
          description: "free dataset desc",
          category: "technology",
          accessType: "free",
          price: 0,
          downloadCount: 0,
          sampleSize: 1,
          isActive: true,
          fileName: "free.csv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      return
    }

    // POST = download
    await route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      headers: {
        "content-disposition": 'attachment; filename="free.csv"',
      },
      body: Buffer.from("a,b\n1,2\n", "utf8"),
    })
  })

  await page.goto(`/en/datasets/${id}`)

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("dataset-download-button").click(),
  ])

  expect(download.suggestedFilename()).toBe("free.csv")
})

test("dataset detail paid download shows an error when unauthorized (mocked)", async ({
  page,
}) => {
  const id = "d-paid-unauth"

  await page.route(`**/api/datasets/${id}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          title: "Paid Dataset",
          description: "paid dataset desc",
          category: "technology",
          accessType: "paid",
          price: 10,
          downloadCount: 0,
          sampleSize: 1,
          isActive: true,
          fileName: "paid.csv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      return
    }

    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    })
  })

  await page.goto(`/en/datasets/${id}`)
  await page.getByTestId("dataset-download-button").click()

  await expect(page.getByTestId("dataset-download-error")).toHaveText(
    "unauthorized"
  )
})

test("dataset detail paid download triggers a file download when endpoint returns a file (mocked)", async ({
  page,
}) => {
  const id = "d-paid"

  await page.route(`**/api/datasets/${id}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          title: "Paid Dataset",
          description: "paid dataset desc",
          category: "technology",
          accessType: "paid",
          price: 10,
          downloadCount: 0,
          sampleSize: 1,
          isActive: true,
          fileName: "paid.csv",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      headers: {
        "content-disposition": 'attachment; filename="paid.csv"',
      },
      body: Buffer.from("x,y\n3,4\n", "utf8"),
    })
  })

  await page.goto(`/en/datasets/${id}`)

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("dataset-download-button").click(),
  ])

  expect(download.suggestedFilename()).toBe("paid.csv")
})

