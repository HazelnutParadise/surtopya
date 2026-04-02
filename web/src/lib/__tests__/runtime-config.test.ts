import { beforeEach, describe, expect, it, vi } from "vitest"
import { getRuntimeConfig } from "@/lib/runtime-config"

describe("runtime config", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("falls back to the default survey base points when config fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    await expect(getRuntimeConfig()).resolves.toEqual({ surveyBasePoints: 1 })
  })
})
