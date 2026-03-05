import { describe, expect, it } from "vitest"
import { normalizeLocalePath, resolveEffectRoute } from "@/lib/effects-route"

describe("normalizeLocalePath", () => {
  it("removes locale prefixes from supported paths", () => {
    expect(normalizeLocalePath("/en/pricing")).toBe("/pricing")
    expect(normalizeLocalePath("/zh-TW/explore")).toBe("/explore")
    expect(normalizeLocalePath("/ja/datasets")).toBe("/datasets")
  })

  it("normalizes root and trailing slashes", () => {
    expect(normalizeLocalePath("/en")).toBe("/")
    expect(normalizeLocalePath("/ja/")).toBe("/")
    expect(normalizeLocalePath("/pricing/")).toBe("/pricing")
  })
})

describe("resolveEffectRoute", () => {
  it("matches only target public routes", () => {
    expect(resolveEffectRoute("/")).toBe("none")
    expect(resolveEffectRoute("/en/about")).toBe("about")
    expect(resolveEffectRoute("/zh-TW/pricing")).toBe("pricing")
    expect(resolveEffectRoute("/ja/terms")).toBe("terms")
    expect(resolveEffectRoute("/en/privacy")).toBe("privacy")
    expect(resolveEffectRoute("/ja/explore")).toBe("explore")
    expect(resolveEffectRoute("/en/datasets")).toBe("datasets")
  })

  it("disables non-target routes and nested pages", () => {
    expect(resolveEffectRoute("/dashboard")).toBe("none")
    expect(resolveEffectRoute("/survey/123")).toBe("none")
    expect(resolveEffectRoute("/create")).toBe("none")
    expect(resolveEffectRoute("/en/datasets/abc")).toBe("none")
  })
})
