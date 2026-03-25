import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  fetchInternalApp: vi.fn(),
  cookies: vi.fn(),
}))

vi.mock("@/lib/api-server", () => ({
  getAuthToken: mocks.getAuthToken,
}))

vi.mock("@/lib/internal-app-fetch", () => ({
  fetchInternalApp: mocks.fetchInternalApp,
}))

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}))

import { GET } from "@/app/api/app/surveys/public/route"

describe("GET /api/app/surveys/public route", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
    mocks.fetchInternalApp.mockReset()
    mocks.cookies.mockReset()
    mocks.getAuthToken.mockResolvedValue(null)
    mocks.cookies.mockResolvedValue({
      get: () => undefined,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("forwards limit/offset/sort and viewer headers to internal app", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    mocks.cookies.mockResolvedValue({
      get: () => ({ value: "anon-1" }),
    })
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ surveys: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new Request(
      "http://localhost/api/app/surveys/public?limit=24&offset=24&sort=recommended"
    )
    const response = await GET(request)

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/surveys/public?limit=24&offset=24&sort=recommended",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Authorization: "Bearer token-1",
          "X-Surtopya-Anonymous-Id": "anon-1",
        },
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ surveys: [] })
  })

  it("omits sort when not provided", async () => {
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ surveys: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new Request("http://localhost/api/app/surveys/public?limit=24&offset=0")
    const response = await GET(request)

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/surveys/public?limit=24&offset=0",
      expect.objectContaining({
        cache: "no-store",
      })
    )
    expect(response.status).toBe(200)
  })
})
