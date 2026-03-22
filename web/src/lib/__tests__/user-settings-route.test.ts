import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  fetchInternalApp: vi.fn(),
}))

vi.mock("@/lib/api-server", () => ({
  API_BASE_URL: "http://api:8080/v1",
  getAuthToken: mocks.getAuthToken,
}))

vi.mock("@/lib/internal-app-fetch", () => ({
  fetchInternalApp: mocks.fetchInternalApp,
}))

import { GET, PATCH } from "@/app/api/app/user-settings/route"

describe("/api/app/user-settings route", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset()
    mocks.fetchInternalApp.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns locale and time zone from cookies when unauthenticated", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/app/user-settings", {
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

  it("normalizes guest cookie aliases before returning settings", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/app/user-settings", {
      headers: {
        cookie: "NEXT_LOCALE=en; SURTOPYA_TIMEZONE=US%2FPacific",
      },
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      locale: "en",
      timeZone: "America/Los_Angeles",
      settingsAutoInitialized: true,
    })
    expect(response.cookies.get("SURTOPYA_TIMEZONE")?.value).toBe("America/Los_Angeles")
  })

  it("ignores autoInitialize for guest updates and only persists cookies", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/app/user-settings", {
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
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ locale: "zh-TW", timeZone: "Asia/Taipei", settingsAutoInitialized: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest("http://localhost/api/app/user-settings", {
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

  it("canonicalizes authenticated patch aliases before proxying upstream", async () => {
    mocks.getAuthToken.mockResolvedValue("token-1")
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ locale: "en", timeZone: "America/Los_Angeles", settingsAutoInitialized: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest("http://localhost/api/app/user-settings", {
      method: "PATCH",
      body: JSON.stringify({ locale: "en", timeZone: "US/Pacific" }),
      headers: {
        "Content-Type": "application/json",
      },
    })

    const response = await PATCH(request)

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/me/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ locale: "en", timeZone: "America/Los_Angeles" }),
      })
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      locale: "en",
      timeZone: "America/Los_Angeles",
      settingsAutoInitialized: true,
    })
    expect(response.cookies.get("SURTOPYA_TIMEZONE")?.value).toBe("America/Los_Angeles")
  })

  it("still rejects clearly invalid guest time zones", async () => {
    mocks.getAuthToken.mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/app/user-settings", {
      method: "PATCH",
      body: JSON.stringify({ locale: "en", timeZone: "Mars/Olympus" }),
      headers: {
        "Content-Type": "application/json",
      },
    })

    const response = await PATCH(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "locale/timeZone is invalid",
    })
  })
})

