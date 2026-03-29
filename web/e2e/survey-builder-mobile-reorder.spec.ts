import { expect, test } from "@playwright/test"

test("mobile builder supports click-add, reorder, save, and publish", async ({ page }) => {
  const surveyId = "44444444-4444-4444-4444-444444444444"

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
    const req = route.request()
    if (req.method() !== "POST") {
      await route.fallback()
      return
    }

    publishCalls += 1
    const body = req.postDataJSON() as Record<string, unknown>

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: surveyId,
        userId: "u1",
        title: lastCreatePayload?.title || "Mobile Survey",
        description: lastCreatePayload?.description || "",
        visibility: body.visibility,
        isPublished: true,
        includeInDatasets: body.includeInDatasets,
        everPublic: body.visibility === "public",
        publishedCount: 1,
        theme: lastCreatePayload?.theme,
        pointsReward: body.pointsReward ?? 0,
        expiresAt: null,
        responseCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        questions: (((lastCreatePayload?.questions as unknown[]) || [])).map((qUnknown, idx: number) => {
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

  await page.route(`**/api/app/surveys/${surveyId}/versions`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        versions: [
          {
            id: "version-1",
            surveyId,
            versionNumber: 1,
            snapshot: {
              title: lastCreatePayload?.title || "Mobile Survey",
              description: lastCreatePayload?.description || "",
              visibility: "public",
              includeInDatasets: true,
              pointsReward: 0,
              questions: lastCreatePayload?.questions || [],
            },
            pointsReward: 0,
            publishedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  await page.goto("/en/create")

  await expect(page.getByText("Data Usage Consent")).toBeVisible()
  await page.getByRole("button", { name: "I Understand and Agree" }).click()

  await expect(page.getByPlaceholder("Untitled Survey")).toBeVisible()
  await page.getByPlaceholder("Untitled Survey").fill("Mobile Survey")

  const toolboxPanel = page.locator("details").filter({ hasText: "Toolbox" }).first()
  await toolboxPanel.locator("summary").click()
  await toolboxPanel.getByTestId("toolbox-text").click()
  await toolboxPanel.getByTestId("toolbox-text").click()

  await page.locator('input[value="Page"]').first().fill("Intro Page")
  await page.locator('input[value="New Question"]').nth(0).fill("First question")
  await page.locator('input[value="New Question"]').first().fill("Second question")

  const secondQuestionCard = page
    .locator('input[value="Second question"]')
    .locator('xpath=ancestor::div[contains(@class, "group")][1]')
  await secondQuestionCard.getByRole("button", { name: "Move up" }).click()

  let canvasValues = await page.locator('[data-testid="survey-canvas"] input').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).value)
  )

  expect(canvasValues.indexOf("Second question")).toBeLessThan(canvasValues.indexOf("First question"))

  const addPageButton = page.getByRole("button", { name: "Add New Page" })
  await addPageButton.scrollIntoViewIfNeeded()
  await addPageButton.click()

  await page.locator('input[value="New Page"]').last().fill("Follow-up Page")

  const followUpPageCard = page
    .locator('input[value="Follow-up Page"]')
    .locator('xpath=ancestor::div[contains(@class, "group")][1]')
  await followUpPageCard.getByRole("button", { name: "Move up" }).click()

  canvasValues = await page.locator('[data-testid="survey-canvas"] input').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).value)
  )

  expect(canvasValues.indexOf("Follow-up Page")).toBeLessThan(canvasValues.indexOf("Intro Page"))

  await page.getByRole("button", { name: "Save" }).click()
  await expect.poll(() => createCalls).toBe(1)

  await page.getByRole("button", { name: "Publish" }).click()
  await page.getByRole("button", { name: "Confirm & Publish" }).click()

  await expect.poll(() => publishCalls).toBe(1)
  await expect(page.getByText("Published").first()).toBeVisible()
})
