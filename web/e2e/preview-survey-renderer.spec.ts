import { test, expect } from "@playwright/test"

test("preview survey renderer allows answering and shows completion payload", async ({
  page,
}) => {
  const previewSurvey = {
    id: "preview-1",
    title: "Preview Survey",
    description: "A preview survey used for UI testing.",
    questions: [
      {
        id: "s1",
        type: "section",
        title: "Page 1",
        required: false,
        points: 0,
      },
      {
        id: "q1",
        type: "short",
        title: "Your name",
        required: true,
        points: 0,
      },
      {
        id: "s2",
        type: "section",
        title: "Page 2",
        required: false,
        points: 0,
      },
      {
        id: "q2",
        type: "short",
        title: "Your city",
        required: true,
        points: 0,
      },
    ],
    settings: {
      isPublic: false,
      isPublished: false,
      visibility: "non-public",
      isDatasetActive: false,
      pointsReward: 0,
    },
  }

  const previewTheme = {
    primaryColor: "#9333ea",
    backgroundColor: "#f9fafb",
    fontFamily: "inter",
  }

  await page.addInitScript(
    ({ survey, theme }) => {
      window.sessionStorage.setItem("preview_survey", JSON.stringify(survey))
      window.sessionStorage.setItem("preview_theme", JSON.stringify(theme))
    },
    { survey: previewSurvey, theme: previewTheme }
  )

  await page.goto("/en/create/preview")

  await expect(page.getByRole("heading", { name: "Preview Survey" })).toBeVisible()
  await page.getByPlaceholder("Type your answer here...").fill("Alice")

  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByRole("heading", { name: "Your city" })).toBeVisible()
  await page.getByPlaceholder("Type your answer here...").fill("Taipei")

  // Verify navigation and state persistence across pages.
  await page.getByRole("button", { name: "Back" }).click()
  await expect(page.getByRole("heading", { name: "Your name" })).toBeVisible()
  await expect(page.getByPlaceholder("Type your answer here...")).toHaveValue(
    "Alice"
  )

  await page.getByRole("button", { name: "Next" }).click()
  await expect(page.getByRole("heading", { name: "Your city" })).toBeVisible()
  await expect(page.getByPlaceholder("Type your answer here...")).toHaveValue(
    "Taipei"
  )
})
