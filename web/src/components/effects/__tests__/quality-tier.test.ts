import { describe, expect, it } from "vitest"
import { getEffectDprCap, resolveEffectQualityTier } from "@/components/effects/quality-tier"

describe("resolveEffectQualityTier", () => {
  it("returns high for capable desktop devices", () => {
    expect(
      resolveEffectQualityTier({
        viewportWidth: 1440,
        deviceMemory: 16,
        hardwareConcurrency: 12,
      })
    ).toBe("high")
  })

  it("returns medium for moderate devices", () => {
    expect(
      resolveEffectQualityTier({
        viewportWidth: 900,
        deviceMemory: 4,
        hardwareConcurrency: 4,
      })
    ).toBe("medium")
  })

  it("returns low for constrained devices", () => {
    expect(
      resolveEffectQualityTier({
        viewportWidth: 420,
        deviceMemory: 2,
        hardwareConcurrency: 2,
      })
    ).toBe("low")
  })

  it("downgrades one tier when device capabilities are missing", () => {
    expect(
      resolveEffectQualityTier({
        viewportWidth: 1440,
        hardwareConcurrency: 12,
      })
    ).toBe("medium")

    expect(
      resolveEffectQualityTier({
        viewportWidth: 1280,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      })
    ).toBe("high")
  })
})

describe("getEffectDprCap", () => {
  it("returns tier-specific dpr caps", () => {
    expect(getEffectDprCap("high")).toBe(1.5)
    expect(getEffectDprCap("medium")).toBe(1.25)
    expect(getEffectDprCap("low")).toBe(1)
  })
})
