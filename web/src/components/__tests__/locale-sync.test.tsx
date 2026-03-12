import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const searchParams = new URLSearchParams("")

  return {
    pathname: "/en/dashboard",
    searchParams,
    routerReplace: vi.fn(),
    routerRefresh: vi.fn(),
    currentTimeZone: "Asia/Taipei",
    detectBrowserLocale: vi.fn(() => "en"),
    detectBrowserTimeZone: vi.fn(() => "Asia/Taipei"),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
    refresh: mocks.routerRefresh,
  }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("next-intl", () => ({
  useTimeZone: () => mocks.currentTimeZone,
}))

vi.mock("@/lib/locale", async () => {
  const actual = await vi.importActual<typeof import("@/lib/locale")>("@/lib/locale")
  return {
    ...actual,
    detectBrowserLocale: mocks.detectBrowserLocale,
  }
})

vi.mock("@/lib/date-time", async () => {
  const actual = await vi.importActual<typeof import("@/lib/date-time")>("@/lib/date-time")
  return {
    ...actual,
    detectBrowserTimeZone: mocks.detectBrowserTimeZone,
  }
})

import { LocaleSync } from "@/components/locale-sync"

describe("LocaleSync", () => {
  beforeEach(() => {
    mocks.routerReplace.mockReset()
    mocks.routerRefresh.mockReset()
    mocks.detectBrowserLocale.mockReset()
    mocks.detectBrowserLocale.mockReturnValue("en")
    mocks.detectBrowserTimeZone.mockReset()
    mocks.detectBrowserTimeZone.mockReturnValue("Asia/Taipei")
    document.cookie = ""
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends a one-time autoInitialize patch for authenticated users that have not been initialized yet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "Asia/Taipei",
          settingsAutoInitialized: false,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "Asia/Taipei",
          settingsAutoInitialized: true,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

    vi.stubGlobal("fetch", fetchMock)

    render(<LocaleSync />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/user-settings")
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/user-settings")
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      locale: "en",
      timeZone: "Asia/Taipei",
      autoInitialize: true,
    })
    expect(mocks.routerReplace).not.toHaveBeenCalled()
    expect(mocks.routerRefresh).not.toHaveBeenCalled()
  })

  it("does not send another autoInitialize patch after the account has been initialized", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        locale: "en",
        timeZone: "Asia/Taipei",
        settingsAutoInitialized: true,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    render(<LocaleSync />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/user-settings")
    expect(mocks.routerReplace).not.toHaveBeenCalled()
    expect(mocks.routerRefresh).not.toHaveBeenCalled()
  })

  it("canonicalizes detected alias time zones before sending the autoInitialize patch", async () => {
    mocks.detectBrowserTimeZone.mockReturnValue("US/Pacific")

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "UTC",
          settingsAutoInitialized: false,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "America/Los_Angeles",
          settingsAutoInitialized: true,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

    vi.stubGlobal("fetch", fetchMock)

    render(<LocaleSync />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      locale: "en",
      timeZone: "America/Los_Angeles",
      autoInitialize: true,
    })
  })
})
