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

import { GET, PATCH } from "@/app/api/app/admin/users/[id]/route"

describe("admin user detail BFF route", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
    mocks.fetchInternalApp.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 for GET when auth token is missing", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new Request("http://localhost/api/app/admin/users/user-1")
    const response = await GET(request, { params: Promise.resolve({ id: "user-1" }) })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
  })

  it("forwards GET to the internal admin user detail endpoint", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", membershipTier: "pro" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new Request("http://localhost/api/app/admin/users/user-1")
    const response = await GET(request, { params: Promise.resolve({ id: "user-1" }) })

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/admin/users/user-1",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: "user-1", membershipTier: "pro" })
  })

  it("still forwards PATCH to the internal admin user endpoint", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ message: "updated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new Request("http://localhost/api/app/admin/users/user-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDisabled: true }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: "user-1" }) })

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/admin/users/user-1",
      expect.objectContaining({
        method: "PATCH",
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: "updated" })
  })
})
