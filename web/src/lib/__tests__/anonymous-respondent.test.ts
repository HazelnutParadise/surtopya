import { describe, expect, it } from "vitest"
import {
  ANONYMOUS_RESPONDENT_COOKIE,
  resolveAnonymousRespondentID,
} from "@/lib/anonymous-respondent"

const mockCookieStore = (value?: string) => ({
  get: (name: string) => {
    if (name !== ANONYMOUS_RESPONDENT_COOKIE || value === undefined) {
      return undefined
    }
    return { value }
  },
})

describe("anonymous respondent id", () => {
  it("reuses valid cookie value", () => {
    const result = resolveAnonymousRespondentID(mockCookieStore("abc123_-xyz7890"))
    expect(result.anonymousId).toBe("abc123_-xyz7890")
    expect(result.shouldSetCookie).toBe(false)
  })

  it("generates a new id when cookie is invalid", () => {
    const result = resolveAnonymousRespondentID(mockCookieStore("bad id"))
    expect(result.anonymousId.length).toBeGreaterThan(10)
    expect(result.shouldSetCookie).toBe(true)
  })
})
