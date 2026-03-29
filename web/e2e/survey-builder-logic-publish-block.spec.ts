import { expect, test } from "@playwright/test"

test("builder blocks publish when contradictory logic exists", async ({ page }) => {
  const surveyId = "55555555-5555-5555-5555-555555555555"

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

  await page.getByPlaceholder("Untitled Survey").fill("Logic Block Survey")

  const toolboxPanel = page.locator("details").filter({ hasText: "Toolbox" }).first()
  await toolboxPanel.locator("summary").click()
  await toolboxPanel.getByTestId("toolbox-multi").click()

  await page.locator('input[value="Page"]').first().fill("Intro Page")
  await page.locator('input[value="New Question"]').first().fill("Choose many")

  const addPageButton = page.getByRole("button", { name: "Add New Page" })
  await addPageButton.scrollIntoViewIfNeeded()
  await addPageButton.click()
  await page.locator('input[value="New Page"]').last().fill("Follow-up Page")

  const questionCard = page
    .locator('input[value="Choose many"]')
    .locator('xpath=ancestor::div[contains(@class, "group")][1]')

  await questionCard.getByRole("button", { name: "Logic Jumps" }).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Add Logic Rule" }).click()
  await dialog.getByRole("button", { name: "Add condition" }).click()

  const comboboxes = dialog.locator('button[role="combobox"]')
  await comboboxes.nth(3).click()
  await page.getByRole("option", { name: "Does not contain" }).click()

  await comboboxes.last().click()
  await page.getByRole("option", { name: "Follow-up Page" }).click()

  await expect(dialog.getByText("This rule contains contradictory conditions.")).toBeVisible()
  await dialog.getByRole("button", { name: "Save Logic" }).click()

  await expect(questionCard.getByRole("button", { name: "Logic Jumps" })).toBeVisible()

  await page.getByRole("button", { name: "Save" }).click()
  await expect.poll(() => createCalls).toBe(1)

  await page.getByRole("button", { name: "Publish" }).click()
  await expect(page.getByTestId("builder-publish-logic-block")).toBeVisible()
  await expect(page.getByRole("button", { name: "Confirm & Publish" })).toBeDisabled()
  await expect.poll(() => publishCalls).toBe(0)
})
