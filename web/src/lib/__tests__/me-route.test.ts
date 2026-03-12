import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  getLogtoConfig: vi.fn(),
  getLogtoContext: vi.fn(),
}))

vi.mock("@/lib/api-server", () => ({
  API_BASE_URL: "http://api:8080/api/v1",
  getAuthToken: mocks.getAuthToken,
}))

vi.mock("@/lib/logto", () => ({
  getLogtoConfig: mocks.getLogtoConfig,
}))

vi.mock("@logto/next/server-actions", () => ({
  getLogtoContext: mocks.getLogtoContext,
}))

import { GET } from "@/app/api/me/route"

describe("GET /api/me route", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
    mocks.getLogtoConfig.mockReset()
    mocks.getLogtoContext.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns 401 when auth token is missing", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
  })

  it("returns 503 when upstream me endpoint returns 5xx", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "upstream_failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "service_unavailable" })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api:8080/api/v1/me",
      expect.objectContaining({
        cache: "no-store",
      })
    )
  })

  it("returns 503 when upstream me fetch throws", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: "service_unavailable" })
  })

  it("keeps upstream 401 status", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
  })
})
