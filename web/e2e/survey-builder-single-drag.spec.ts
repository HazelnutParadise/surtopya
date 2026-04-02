import { expect, test } from "@playwright/test"

test("dragging a single-choice question from the toolbox inserts it without runtime errors", async ({
  page,
}) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on("pageerror", (error) => {
    pageErrors.push(error.message)
  })

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

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

  await page.goto("/create")

  await expect(page.getByText("Data Usage Consent")).toBeVisible()
  await page.getByRole("button", { name: "I Understand and Agree" }).click()
  await expect(page.getByPlaceholder("Untitled Survey")).toBeVisible()

  const toolboxSingle = page.getByTestId("toolbox-single").first()
  const dropTarget = page.locator('input[value="Page"]').first()
  const tailDropZone = page.getByTestId("survey-canvas-tail-dropzone")

  const from = await toolboxSingle.boundingBox()
  const to = await dropTarget.boundingBox()
  const tail = await tailDropZone.boundingBox()

  expect(from).toBeTruthy()
  expect(to).toBeTruthy()
  expect(tail).toBeTruthy()

  const startX = from!.x + from!.width / 2
  const startY = from!.y + from!.height / 2
  const endX = to!.x + to!.width / 2
  const endY = to!.y + to!.height / 2
  const hoverX = tail!.x + tail!.width / 2
  const hoverY = to!.y + to!.height + ((tail!.y - (to!.y + to!.height)) / 2)

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 20, startY + 10, { steps: 4 })
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 12 })
  await page.mouse.move(endX, endY, { steps: 16 })
  await page.mouse.move(hoverX, hoverY, { steps: 18 })
  await page.waitForTimeout(500)
  await page.mouse.move(hoverX - 24, hoverY + 12, { steps: 6 })
  await page.mouse.move(hoverX + 24, hoverY - 12, { steps: 6 })
  await page.mouse.up()

  await expect(page.locator('input[value="New Question"]').first()).toBeVisible()
  await expect(page.locator('input[value="Option 1"]').first()).toBeVisible()
  await expect(page.locator('input[value="Option 2"]').first()).toBeVisible()

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})
