import { test, expect } from "@playwright/test"

test("survey builder can add a question, save, and publish (mocked API)", async ({
  page,
}) => {
  const surveyId = "33333333-3333-3333-3333-333333333333"

  let createCalls = 0
  let publishCalls = 0
  let lastCreatePayload: Record<string, unknown> | null = null

  await page.route("**/api/surveys", async (route) => {
    const req = route.request()
    if (req.method() !== "POST") {
      await route.fallback()
      return
    }

    createCalls++
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
        questions: ((lastCreatePayload.questions as unknown[]) || []).map((qUnknown, idx: number) => {
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

  await page.route(`**/api/surveys/${surveyId}/publish`, async (route) => {
    const req = route.request()
    if (req.method() !== "POST") {
      await route.fallback()
      return
    }

    publishCalls++
    const body = req.postDataJSON() as Record<string, unknown>

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: surveyId,
        userId: "u1",
        title: lastCreatePayload?.title || "My Survey",
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

  await page.goto("/en/create")

  await expect(page.getByText("Data Usage Consent")).toBeVisible()
  await page.getByRole("button", { name: "I Understand and Agree" }).click()

  await expect(page.getByPlaceholder("Untitled Survey")).toBeVisible()

  await page.getByPlaceholder("Untitled Survey").fill("My Survey")

  const toolboxText = page.getByTestId("toolbox-text").first()
  const dropTarget = page.locator('input[value="Page 1"]').first()

  const from = await toolboxText.boundingBox()
  const to = await dropTarget.boundingBox()
  expect(from).toBeTruthy()
  expect(to).toBeTruthy()

  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2)
  await page.mouse.up()

  await page.locator('input[value="New Question"]').first().fill("How are you?")

  await page.getByRole("button", { name: "Save" }).click()
  await expect.poll(() => createCalls).toBe(1)

  expect(lastCreatePayload).toBeTruthy()
  const questions = (lastCreatePayload!.questions as unknown[]) || []
  expect(Array.isArray(questions)).toBe(true)
  expect(questions.length).toBeGreaterThan(0)
  expect((questions[0] as Record<string, unknown>).points).toBeUndefined()

  await page.getByRole("button", { name: "Publish" }).click()
  await page.getByRole("button", { name: "Confirm & Publish" }).click()

  await expect.poll(() => publishCalls).toBe(1)
  await expect(page.getByText("Published").first()).toBeVisible()
})
