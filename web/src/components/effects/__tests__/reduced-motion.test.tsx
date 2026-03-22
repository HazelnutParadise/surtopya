import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SiteEffectsLayer } from "@/components/effects/SiteEffectsLayer"

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/pricing",
}))

const installMatchMediaMock = (reducedMotion: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const matches =
        query === "(prefers-reduced-motion: reduce)"
          ? reducedMotion
          : query === "(prefers-color-scheme: dark)"
            ? false
            : false

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
}

describe("SiteEffectsLayer reduced-motion fallback", () => {
  beforeEach(() => {
    installMatchMediaMock(true)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders fallback and skips webgl canvas when reduced motion is enabled", async () => {
    render(<SiteEffectsLayer />)

    await waitFor(() => {
      expect(screen.getByTestId("site-effects-fallback")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("site-webgl-canvas")).not.toBeInTheDocument()
  })
})
