import { describe, expect, it } from "vitest"

import {
  determineAutoDetectedSettingsPatch,
  type UserSettingsResponse,
} from "@/lib/user-settings"

describe("determineAutoDetectedSettingsPatch", () => {
  const defaults: UserSettingsResponse = {
    locale: "en",
    timeZone: "Asia/Taipei",
    settingsAutoInitialized: false,
  }

  it("creates a one-time bootstrap patch when account settings are not initialized yet", () => {
    expect(
      determineAutoDetectedSettingsPatch({
        currentSettings: defaults,
        detectedLocale: "en",
        detectedTimeZone: "Asia/Taipei",
      })
    ).toEqual({
      locale: "en",
      timeZone: "Asia/Taipei",
      autoInitialize: true,
    })
  })

  it("prefers pre-existing guest cookies when bootstrapping a first authenticated session", () => {
    expect(
      determineAutoDetectedSettingsPatch({
        currentSettings: defaults,
        initialCookieLocale: "ja",
        initialCookieTimeZone: "Asia/Tokyo",
        detectedLocale: "en",
        detectedTimeZone: "America/New_York",
      })
    ).toEqual({
      locale: "ja",
      timeZone: "Asia/Tokyo",
      autoInitialize: true,
    })
  })

  it("does not create another bootstrap patch after initialization has completed", () => {
    expect(
      determineAutoDetectedSettingsPatch({
        currentSettings: {
          locale: "ja",
          timeZone: "Asia/Tokyo",
          settingsAutoInitialized: true,
        },
        detectedLocale: "en",
        detectedTimeZone: "America/New_York",
      })
    ).toBeNull()
  })
})
