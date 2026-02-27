import { test, expect } from "@playwright/test"

test("admin can switch membership tier to pro (mocked API)", async ({
  page,
}) => {
  let patchCalls = 0
  let lastPatchBody: Record<string, unknown> | null = null

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "me",
        email: "me@example.com",
        displayName: "Super Admin",
        pointsBalance: 0,
        membershipTier: "free",
        capabilities: {},
        isAdmin: true,
        isSuperAdmin: true,
        locale: "en",
        createdAt: new Date().toISOString(),
        surveysCompleted: 0,
      }),
    })
  })

  await page.route("**/api/admin/surveys?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveys: [], meta: { limit: 20, offset: 0 } }),
    })
  })

  await page.route("**/api/admin/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ datasets: [], meta: { limit: 20, offset: 0 } }),
    })
  })

  await page.route("**/api/admin/users?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: "u-1",
            email: "user@example.com",
            displayName: "User One",
            membershipTier: "free",
            isAdmin: false,
            isSuperAdmin: false,
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { limit: 20, offset: 0 },
      }),
    })
  })

  await page.route("**/api/admin/policies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tiers: [],
        capabilities: [],
        matrix: [],
      }),
    })
  })

  await page.route("**/api/admin/policy-writers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [],
      }),
    })
  })

  await page.route("**/api/admin/users/u-1", async (route) => {
    const req = route.request()
    if (req.method() !== "PATCH") {
      await route.fallback()
      return
    }
    patchCalls++
    lastPatchBody = req.postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "User updated" }),
    })
  })

  await page.goto("/en/admin")

  await page.getByRole("tab", { name: "Admins" }).click()
  await expect(page.getByText("User One")).toBeVisible()

  await page.getByTestId("admin-tier-pro-u-1").click()

  await expect.poll(() => patchCalls).toBe(1)
  expect(lastPatchBody).toEqual({ membershipTier: "pro" })
})
