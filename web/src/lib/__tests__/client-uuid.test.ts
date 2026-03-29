import { describe, expect, it } from "vitest"
import { generateClientUUID } from "@/lib/client-uuid"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe("generateClientUUID", () => {
  it("generates backend-safe UUID ids", () => {
    const first = generateClientUUID()
    const second = generateClientUUID()

    expect(first).toMatch(UUID_PATTERN)
    expect(second).toMatch(UUID_PATTERN)
    expect(first).not.toBe(second)
  })
})
