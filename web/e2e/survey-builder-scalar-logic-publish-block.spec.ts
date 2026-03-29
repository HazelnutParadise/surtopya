import { expect, test } from "@playwright/test"

test("builder blocks publish when rating range logic is invalid", async ({ page }) => {
  const surveyId = "66666666-6666-6666-6666-666666666666"

  let createCalls = 0
  let publishCalls = 0
  let lastCreatePayload: Record<string, unknown> | null = null

  await page.setViewportSize({ width: 390, height: 844 })

  await page.route("**/api/app/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "me",
        email: "me@example.com",
        displayName: "Me",
        capabilities: {},
      }),
    })
  })

  await page.route("**/api/app/surveys", async (route) => {
    const req = route.request()
    if (req.method() !== "POST") {
      await route.fallback()
      return
    }

    createCalls += 1
    lastCreatePayload = req.postDataJSON() as Record<string, unknown>

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: surveyId,
        userId: "u1",
        title: lastCreatePayload.title,
        description: lastCreatePayload.description,
        visibility: lastCreatePayload.visibility,
        isPublished: false,
        includeInDatasets: lastCreatePayload.includeInDatasets,
        everPublic: false,
        publishedCount: 0,
        theme: lastCreatePayload.theme,
        pointsReward: lastCreatePayload.pointsReward,
        expiresAt: null,
        responseCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        questions: (((lastCreatePayload.questions as unknown[]) || [])).map((qUnknown, idx: number) => {
          const q = qUnknown as Record<string, unknown>
          return {
            id: q.id,
            surveyId,
            type: q.type,
            title: q.title,
            description: q.description,
            options: q.options,
            required: q.required,
            maxRating: q.maxRating,
            logic: q.logic,
            sortOrder: idx,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        }),
      }),
    })
  })

  await page.route(`**/api/app/surveys/${surveyId}/publish`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }

    publishCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route(`**/api/app/surveys/${surveyId}/versions`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ versions: [] }),
    })
  })

  await page.goto("/en/create")

  await expect(page.getByText("Data Usage Consent")).toBeVisible()
  await page.getByRole("button", { name: "I Understand and Agree" }).click()

  await page.getByPlaceholder("Untitled Survey").fill("Scalar Logic Block Survey")

  const toolboxPanel = page.locator("details").filter({ hasText: "Toolbox" }).first()
  await toolboxPanel.locator("summary").click()
  await toolboxPanel.getByTestId("toolbox-rating").click()

  await page.locator('input[value="Page"]').first().fill("Intro Page")
  await page.locator('input[value="New Question"]').first().fill("Rate the product")

  const addPageButton = page.getByRole("button", { name: "Add New Page" })
  await addPageButton.scrollIntoViewIfNeeded()
  await addPageButton.click()
  await page.locator('input[value="New Page"]').last().fill("Follow-up Page")

  const questionCard = page
    .locator('input[value="Rate the product"]')
    .locator('xpath=ancestor::div[contains(@class, "group")][1]')

  await questionCard.getByRole("button", { name: "Logic Jumps" }).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Add Logic Rule" }).click()

  const comboboxes = dialog.locator('button[role="combobox"]')
  await comboboxes.first().click()
  await page.getByRole("option", { name: "Between", exact: true }).click()

  const numberInputs = dialog.locator('input[type="number"]')
  await numberInputs.nth(0).fill("5")
  await numberInputs.nth(1).fill("3")

  await expect(dialog.getByText("Between 3 and 5 includes both 3 and 5.")).toBeVisible()

  await comboboxes.last().click()
  await page.getByRole("option", { name: "Follow-up Page" }).click()

  await dialog.getByRole("button", { name: "Save Logic" }).click()

  await page.getByRole("button", { name: "Save" }).click()
  await expect.poll(() => createCalls).toBe(1)

  await page.getByRole("button", { name: "Publish" }).click()
  await expect(page.getByTestId("builder-publish-logic-block")).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm & Publish" })).toBeDisabled()
  await expect.poll(() => publishCalls).toBe(0)
})
