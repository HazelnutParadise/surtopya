import { describe, expect, it } from "vitest"

import { defaultLocale, matchSupportedLocale, resolvePreferredLocale } from "@/lib/locale"

describe("locale helpers", () => {
  it("uses english as the project-wide default locale", () => {
    expect(defaultLocale).toBe("en")
  })

  it("matches exact and language-only browser locales", () => {
    expect(matchSupportedLocale("zh-TW")).toBe("zh-TW")
    expect(matchSupportedLocale("en-US")).toBe("en")
    expect(matchSupportedLocale("ja-JP")).toBe("ja")
  })

  it("resolves the first supported locale from a browser preference list", () => {
    expect(resolvePreferredLocale(["fr-FR", "en-US", "ja-JP"])).toBe("en")
  })

  it("falls back to english when no supported browser locale is present", () => {
    expect(resolvePreferredLocale(["fr-FR", "de-DE"])).toBe("en")
  })
})
