import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pathname: "/en/dashboard/settings",
  searchParams: new URLSearchParams(""),
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
  currentTimeZone: "America/New_York",
}))

const router = {
  replace: mocks.routerReplace,
  refresh: mocks.routerRefresh,
}

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("next-intl", () => ({
  useTimeZone: () => mocks.currentTimeZone,
  useTranslations: (namespace: string) => {
    if (namespace === "Settings") {
      const settingsMessages: Record<string, string> = {
        title: "Settings",
        description: "Settings description",
        appearanceTitle: "Appearance",
        appearanceDescription: "Appearance description",
        language: "Language",
        languageDescription: "Language description",
        languageZhTw: "繁體中文",
        languageEn: "English",
        languageJa: "日本語",
        timeZone: "Time zone",
        timeZoneDescription: "Time zone description",
        timeZonePlaceholder: "Time zone",
        timeZoneInvalid: "Invalid time zone",
        saveError: "Save failed",
      }
      return (key: string) => settingsMessages[key] ?? key
    }

    if (namespace === "Common") {
      const commonMessages: Record<string, string> = {
        cancel: "Cancel",
        save: "Save",
        saving: "Saving",
      }
      return (key: string) => commonMessages[key] ?? key
    }

    return (key: string) => key
  },
}))

import SettingsClient from "../settings-client"

describe("SettingsClient", () => {
  beforeEach(() => {
    mocks.routerReplace.mockReset()
    mocks.routerRefresh.mockReset()
    document.cookie = ""
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("saves canonicalized time zones when the user enters a supported alias", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "America/New_York",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          locale: "en",
          timeZone: "America/Los_Angeles",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )

    vi.stubGlobal("fetch", fetchMock)

    render(<SettingsClient />)

    const timeZoneInput = await screen.findByLabelText("Time zone")
    await waitFor(() => expect(timeZoneInput).toHaveValue("America/New_York"))
    fireEvent.change(timeZoneInput, { target: { value: "US/Pacific" } })
    await waitFor(() => expect(timeZoneInput).toHaveValue("US/Pacific"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        ([url, options]) => url === "/api/user-settings" && options?.method === "PATCH"
      )
      expect(patchCalls).toHaveLength(1)
      expect(patchCalls[0]?.[1]).toMatchObject({
        method: "PATCH",
        body: JSON.stringify({
          locale: "en",
          timeZone: "America/Los_Angeles",
        }),
      })
    })
  })

  it("shows an error and does not save when the time zone cannot be canonicalized", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        locale: "en",
        timeZone: "America/New_York",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    render(<SettingsClient />)

    const timeZoneInput = await screen.findByLabelText("Time zone")
    await waitFor(() => expect(timeZoneInput).toHaveValue("America/New_York"))
    fireEvent.change(timeZoneInput, { target: { value: "Mars/Olympus" } })

    expect(screen.getByText("Invalid time zone")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    const patchCalls = fetchMock.mock.calls.filter(
      ([url, options]) => url === "/api/user-settings" && options?.method === "PATCH"
    )
    expect(patchCalls).toHaveLength(0)
  })
})
