import { expect, test } from "@playwright/test"

test("users tab filters are forwarded and disabled toggle updates user", async ({
  page,
}) => {
  const usersQueries: string[] = []
  let patchCalls = 0
  let lastPatchBody: Record<string, unknown> | null = null

  await page.route("**/api/app/me*", async (route) => {
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

  await page.route("**/api/app/admin/surveys?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveys: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ datasets: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/agents?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/policies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tiers: [
          { id: "t-free", code: "free", name: "Free", isActive: true },
          { id: "t-pro", code: "pro", name: "Pro", isActive: true },
        ],
        capabilities: [
          {
            id: "c-1",
            key: "survey.public_dataset_opt_out",
            name: "opt out",
            description: "desc",
            isActive: true,
            showOnPricing: true,
            nameI18n: { "zh-TW": "a", en: "a", ja: "a" },
            descriptionI18n: { "zh-TW": "b", en: "b", ja: "b" },
          },
        ],
        matrix: [],
      }),
    })
  })
  await page.route("**/api/app/admin/policy-writers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [] }),
    })
  })
  await page.route("**/api/app/admin/system-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1, signupInitialPoints: 0 }),
    })
  })

  await page.route("**/api/app/admin/users?*", async (route) => {
    usersQueries.push(new URL(route.request().url()).search)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: "u-1",
            email: "user@example.com",
            displayName: "User One",
            membershipTier: "pro",
            membershipIsPermanent: true,
            isAdmin: false,
            isSuperAdmin: false,
            isDisabled: false,
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { limit: 20, offset: 0 },
      }),
    })
  })
  await page.route("**/api/app/admin/users/u-1", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback()
      return
    }
    patchCalls += 1
    lastPatchBody = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "User updated" }),
    })
  })

  await page.goto("/en/admin")
  await page.getByRole("tab", { name: "Users" }).click()
  await expect(page.getByText("User One")).toBeVisible()

  await page.getByTestId("admin-user-role-filter").selectOption("admin")
  await page.getByTestId("admin-user-tier-filter").selectOption("pro")
  await page.getByTestId("admin-user-disabled-filter").selectOption("true")

  await expect.poll(() => usersQueries.some((query) => query.includes("role=admin"))).toBeTruthy()
  await expect.poll(() =>
    usersQueries.some((query) => query.includes("membership_tier=pro"))
  ).toBeTruthy()
  await expect.poll(() =>
    usersQueries.some((query) => query.includes("is_disabled=true"))
  ).toBeTruthy()

  await page.getByTestId("admin-user-disabled-u-1").click()
  await expect.poll(() => patchCalls).toBe(1)
  expect(lastPatchBody).toEqual({ isDisabled: true })
})

test("inactive subscription plans are grouped under collapsible section", async ({
  page,
}) => {
  await page.route("**/api/app/me*", async (route) => {
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

  await page.route("**/api/app/admin/surveys?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveys: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ datasets: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/users?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/agents?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/policies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tiers: [
          { id: "t-free", code: "free", name: "Free", isActive: true },
          { id: "t-pro", code: "pro", name: "Pro", isActive: true },
          {
            id: "t-legacy",
            code: "legacy",
            name: "Legacy",
            isActive: false,
            replacementTierCode: "free",
          },
        ],
        capabilities: [
          {
            id: "c-1",
            key: "survey.public_dataset_opt_out",
            name: "opt out",
            description: "desc",
            isActive: true,
            showOnPricing: true,
            nameI18n: { "zh-TW": "a", en: "a", ja: "a" },
            descriptionI18n: { "zh-TW": "b", en: "b", ja: "b" },
          },
        ],
        matrix: [],
      }),
    })
  })
  await page.route("**/api/app/admin/policy-writers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [] }),
    })
  })
  await page.route("**/api/app/admin/system-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1, signupInitialPoints: 0 }),
    })
  })

  await page.goto("/en/admin")
  await page.getByRole("tab", { name: "Policies" }).click()

  const collapsible = page.getByTestId("admin-inactive-plans-collapsible")
  await expect(collapsible).toBeVisible()
  await expect(page.getByTestId("admin-inactive-plan-legacy")).not.toBeVisible()

  await collapsible.locator("summary").click()
  await expect(page.getByTestId("admin-inactive-plan-legacy")).toBeVisible()
})

test("admin tab add button opens modal and promotes non-admin user", async ({
  page,
}) => {
  let patchCalls = 0
  let lastPatchBody: Record<string, unknown> | null = null

  await page.route("**/api/app/me*", async (route) => {
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
  await page.route("**/api/app/admin/surveys?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveys: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ datasets: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/agents?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/policies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tiers: [{ id: "t-free", code: "free", name: "Free", isActive: true }],
        capabilities: [],
        matrix: [],
      }),
    })
  })
  await page.route("**/api/app/admin/policy-writers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [] }),
    })
  })
  await page.route("**/api/app/admin/system-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1, signupInitialPoints: 0 }),
    })
  })

  await page.route("**/api/app/admin/users?*", async (route) => {
    const query = new URL(route.request().url()).search
    if (query.includes("role=non_admin")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              id: "u-2",
              email: "candidate@example.com",
              displayName: "Candidate",
              membershipTier: "free",
              membershipIsPermanent: true,
              isAdmin: false,
              isSuperAdmin: false,
              isDisabled: false,
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { limit: 50, offset: 0 },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: "u-admin",
            email: "admin@example.com",
            displayName: "Admin One",
            membershipTier: "pro",
            membershipIsPermanent: true,
            isAdmin: true,
            isSuperAdmin: false,
            isDisabled: false,
            createdAt: new Date().toISOString(),
          },
        ],
        meta: { limit: 20, offset: 0 },
      }),
    })
  })
  await page.route("**/api/app/admin/users/u-2", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback()
      return
    }
    patchCalls += 1
    lastPatchBody = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "User updated" }),
    })
  })

  await page.goto("/en/admin")
  await page.getByRole("tab", { name: "Admins" }).click()
  await page.getByTestId("admin-add-button").click()
  await expect(page.getByTestId("admin-add-modal")).toBeVisible()
  await page.getByTestId("admin-add-search").fill("candidate")
  await page.getByTestId("admin-add-select").selectOption("u-2")
  await page.getByTestId("admin-add-confirm").click()

  await expect.poll(() => patchCalls).toBe(1)
  expect(lastPatchBody).toEqual({ isAdmin: true })
})

test("new plan validation blocks empty payload before POST", async ({ page }) => {
  let createPlanCalls = 0

  await page.route("**/api/app/me*", async (route) => {
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
  await page.route("**/api/app/admin/surveys?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveys: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/datasets?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ datasets: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/agents?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accounts: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/users?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [], meta: { limit: 20, offset: 0 } }),
    })
  })
  await page.route("**/api/app/admin/policies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tiers: [{ id: "t-free", code: "free", name: "Free", isActive: true }],
        capabilities: [],
        matrix: [],
      }),
    })
  })
  await page.route("**/api/app/admin/policy-writers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ users: [] }),
    })
  })
  await page.route("**/api/app/admin/system-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ surveyBasePoints: 1, signupInitialPoints: 0 }),
    })
  })
  await page.route("**/api/app/admin/subscription-plans", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback()
      return
    }
    createPlanCalls += 1
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "t-new", code: "new" }),
    })
  })

  await page.goto("/en/admin")
  await page.getByRole("tab", { name: "Policies" }).click()
  await page.getByRole("button", { name: "Create Plan" }).click()

  await expect.poll(() => createPlanCalls).toBe(0)
  await expect(page.getByText("Plan code is required")).toBeVisible()
})
