import { expect, test } from "@playwright/test"

test("pricing page renders plans from API", async ({ page }) => {
  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    })
  })

  await page.route("**/api/pricing/plans?locale=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plans: [
          {
            code: "free",
            name: "Free",
            description: "Free plan",
            priceCentsUsd: 0,
            currency: "USD",
            billingInterval: "month",
            isPurchasable: true,
            benefits: [{ key: "a", name: "Basic analytics", description: "" }],
          },
          {
            code: "pro",
            name: "Pro",
            description: "Pro plan",
            priceCentsUsd: 2900,
            currency: "USD",
            billingInterval: "month",
            isPurchasable: true,
            benefits: [{ key: "b", name: "Dataset opt-out", description: "" }],
          },
        ],
      }),
    })
  })

  await page.goto("/en/pricing")
  await expect(page.getByRole("heading", { name: "Free" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible()
  await expect(page.getByText("Basic analytics")).toBeVisible()
  await expect(page.getByText("Dataset opt-out")).toBeVisible()
})
