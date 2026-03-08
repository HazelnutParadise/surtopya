// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import {
  anonymousClaimStorageKey,
  clearAnonymousClaimContext,
  readActiveAnonymousClaimContext,
  readAnonymousClaimContext,
  writeAnonymousClaimContext,
} from "@/lib/anonymous-claim"

describe("anonymous claim session storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("writes and reads active claim context", () => {
    writeAnonymousClaimContext({
      responseId: "r1",
      claimToken: "token-1",
      pointsAwarded: 9,
      expiresAt: "2026-03-08T00:00:00.000Z",
      status: "pending",
    })

    expect(readAnonymousClaimContext("r1")).toEqual({
      responseId: "r1",
      claimToken: "token-1",
      pointsAwarded: 9,
      expiresAt: "2026-03-08T00:00:00.000Z",
      status: "pending",
    })
    expect(readActiveAnonymousClaimContext()?.responseId).toBe("r1")
  })

  it("clears active claim context", () => {
    writeAnonymousClaimContext({
      responseId: "r1",
      claimToken: "token-1",
      pointsAwarded: 9,
      expiresAt: "2026-03-08T00:00:00.000Z",
      status: "pending",
    })

    clearAnonymousClaimContext("r1")

    expect(window.sessionStorage.getItem(anonymousClaimStorageKey("r1"))).toBeNull()
    expect(readActiveAnonymousClaimContext()).toBeNull()
  })
})
