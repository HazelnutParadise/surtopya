import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  fetchInternalApp: vi.fn(),
}))

vi.mock("@/lib/api-server", () => ({
  getAuthToken: mocks.getAuthToken,
}))

vi.mock("@/lib/internal-app-fetch", () => ({
  fetchInternalApp: mocks.fetchInternalApp,
}))

import { GET } from "@/app/api/app/surveys/[id]/responses/analytics/route"

describe("GET /api/app/surveys/[id]/responses/analytics", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
    mocks.fetchInternalApp.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when auth token is missing", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new Request("http://localhost/api/app/surveys/survey-1/responses/analytics")
    const response = await GET(request, { params: Promise.resolve({ id: "survey-1" }) })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
  })

  it("forwards version query to internal app endpoint", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ summary: { totalResponses: 10 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new Request("http://localhost/api/app/surveys/survey-1/responses/analytics?version=2")
    const response = await GET(request, { params: Promise.resolve({ id: "survey-1" }) })

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/surveys/survey-1/responses/analytics?version=2",
      expect.objectContaining({
        cache: "no-store",
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ summary: { totalResponses: 10 } })
  })
})
