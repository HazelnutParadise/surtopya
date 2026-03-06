import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PageMotionShell } from "@/components/motion/page-motion-shell"

const installMatchMediaMock = (reducedMotion: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("PageMotionShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("starts hidden and becomes visible on animation frame", () => {
    installMatchMediaMock(false)
    let rafCallback: FrameRequestCallback | null = null
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallback = callback
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

    render(
      <PageMotionShell>
        <div data-testid="inner">inner</div>
      </PageMotionShell>
    )

    const wrapper = screen.getByTestId("inner").parentElement
    expect(wrapper).toHaveClass("motion-page-enter")
    expect(wrapper).not.toHaveClass("motion-page-enter-visible")

    act(() => {
      rafCallback?.(16)
    })
    expect(wrapper).toHaveClass("motion-page-enter-visible")
  })

  it("is immediately visible when prefers-reduced-motion is enabled", () => {
    installMatchMediaMock(true)

    render(
      <PageMotionShell>
        <div data-testid="inner">inner</div>
      </PageMotionShell>
    )

    const wrapper = screen.getByTestId("inner").parentElement
    expect(wrapper).toHaveClass("motion-page-enter-visible")
  })
})

