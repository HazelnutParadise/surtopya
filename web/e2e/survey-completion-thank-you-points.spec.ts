import { test, expect } from "@playwright/test"

test("survey completion navigates to thank-you and shows points awarded (mock api)", async ({
  page,
}) => {
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "me",
        email: "me@example.com",
        displayName: "Me",
        pointsBalance: 0,
        isPro: false,
        isAdmin: false,
        isSuperAdmin: false,
        locale: "en",
        createdAt: new Date().toISOString(),
        surveysCompleted: 0,
      }),
    })
  })

  const surveyId = "22222222-2222-2222-2222-222222222222"
  await page.goto(`/en/survey/${surveyId}`)

  await expect(page.getByRole("heading", { name: "Mock Survey" })).toBeVisible()
  await page.getByRole("button", { name: /start survey/i }).click()

  await page.getByPlaceholder("Type your answer here...").fill("Alice")
  await page.getByRole("button", { name: /^submit$/i }).click()

  await expect(page).toHaveURL(/\/en\/survey\/thank-you\?points=6/)
  await expect(page.getByTestId("thank-you-points")).toHaveText("+6")
})
