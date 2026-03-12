import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
}))

vi.mock("@/lib/api-server", () => ({
  API_BASE_URL: "http://api:8080/api/v1",
  getAuthToken: mocks.getAuthToken,
}))

import { GET, PATCH } from "@/app/api/user-settings/route"

describe("/api/user-settings route", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns locale and time zone from cookies when unauthenticated", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/user-settings", {
      headers: {
        cookie: "NEXT_LOCALE=ja; SURTOPYA_TIMEZONE=Asia%2FTokyo",
      },
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      locale: "ja",
      timeZone: "Asia/Tokyo",
      settingsAutoInitialized: true,
    })
  })

  it("ignores autoInitialize for guest updates and only persists cookies", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/user-settings", {
      method: "PATCH",
      body: JSON.stringify({ locale: "en", timeZone: "Asia/Taipei", autoInitialize: true }),
      headers: {
        "Content-Type": "application/json",
      },
    })

    const response = await PATCH(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      locale: "en",
      timeZone: "Asia/Taipei",
      settingsAutoInitialized: true,
    })
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("en")
    expect(response.cookies.get("SURTOPYA_TIMEZONE")?.value).toBe("Asia/Taipei")
  })

  it("mirrors upstream authenticated settings into cookies", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ locale: "zh-TW", timeZone: "Asia/Taipei", settingsAutoInitialized: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    const request = new NextRequest("http://localhost/api/user-settings", {
      method: "PATCH",
      body: JSON.stringify({ locale: "zh-TW", timeZone: "Asia/Taipei" }),
      headers: {
        "Content-Type": "application/json",
      },
    })

    const response = await PATCH(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      locale: "zh-TW",
      timeZone: "Asia/Taipei",
      settingsAutoInitialized: false,
    })
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("zh-TW")
    expect(response.cookies.get("SURTOPYA_TIMEZONE")?.value).toBe("Asia/Taipei")
  })
})
