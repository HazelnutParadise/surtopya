import { describe, expect, it } from "vitest"

import {
  canonicalizeTimeZone,
  formatUtcDateOnly,
  formatUtcDateTime,
  isValidIanaTimeZone,
  localDatetimeToUtcISOString,
  normalizePersistedTimeZone,
  utcToDateOnly,
  utcToDatetimeLocal,
} from "@/lib/date-time"

describe("date-time helpers", () => {
  it("validates IANA time zones", () => {
    expect(isValidIanaTimeZone("Asia/Taipei")).toBe(true)
    expect(isValidIanaTimeZone("Mars/Olympus")).toBe(false)
  })

  it("canonicalizes supported aliases to backend-safe time zones", () => {
    expect(canonicalizeTimeZone("US/Pacific")).toBe("America/Los_Angeles")
    expect(canonicalizeTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata")
    expect(canonicalizeTimeZone("Etc/UTC")).toBe("UTC")
  })

  it("falls back when a time zone cannot be canonicalized", () => {
    expect(canonicalizeTimeZone("Mars/Olympus")).toBeNull()
    expect(normalizePersistedTimeZone("Mars/Olympus", "Asia/Taipei")).toBe("Asia/Taipei")
  })

  it("converts UTC timestamps to datetime-local values", () => {
    expect(utcToDatetimeLocal("2026-03-11T07:00:00Z", "Asia/Taipei")).toBe("2026-03-11T15:00")
  })

  it("converts UTC timestamps to local date-only values using local day boundaries", () => {
    expect(utcToDateOnly("2026-03-11T06:00:00Z", "America/Los_Angeles")).toBe("2026-03-10")
  })

  it("formats UTC timestamps in the requested time zone", () => {
    expect(formatUtcDateTime("2026-03-11T07:00:00Z", { locale: "en-GB", timeZone: "Asia/Taipei" })).toContain("15:00")
    expect(formatUtcDateOnly("2026-03-11T06:00:00Z", { locale: "en-US", timeZone: "America/Los_Angeles" })).toBe("03/10/2026")
  })

  it("converts local datetime values back to UTC ISO strings", () => {
    expect(localDatetimeToUtcISOString("2026-03-11T15:00", "Asia/Taipei")).toBe("2026-03-11T07:00:00.000Z")
  })
})
