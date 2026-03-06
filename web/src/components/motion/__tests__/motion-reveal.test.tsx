import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MotionReveal } from "@/components/motion/motion-reveal"

type IntersectionObserverInstance = {
  callback: IntersectionObserverCallback
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  trigger: (isIntersecting: boolean, target?: Element) => void
}

const observerInstances: IntersectionObserverInstance[] = []

const installIntersectionObserverMock = () => {
  observerInstances.length = 0

  class MockIntersectionObserver {
    callback: IntersectionObserverCallback
    observe = vi.fn()
    disconnect = vi.fn()

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
      const instance: IntersectionObserverInstance = {
        callback: this.callback,
        observe: this.observe,
        disconnect: this.disconnect,
        trigger: (isIntersecting: boolean, target?: Element) => {
          const entry = {
            isIntersecting,
            target: target ?? document.createElement("div"),
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: isIntersecting ? 1 : 0,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now(),
          } as IntersectionObserverEntry
          this.callback([entry], this as unknown as IntersectionObserver)
        },
      }
      observerInstances.push(instance)
    }
  }

  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: MockIntersectionObserver,
  })
}

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

describe("MotionReveal", () => {
  beforeEach(() => {
    installMatchMediaMock(false)
    installIntersectionObserverMock()
  })

  it("starts hidden by default", () => {
    render(
      <MotionReveal>
        <div data-testid="content">content</div>
      </MotionReveal>
    )

    const wrapper = screen.getByTestId("content").parentElement
    expect(wrapper).toHaveClass("motion-reveal")
    expect(wrapper).not.toHaveClass("motion-reveal-visible")
  })

  it("becomes visible after intersection", () => {
    render(
      <MotionReveal>
        <div data-testid="content">content</div>
      </MotionReveal>
    )

    const wrapper = screen.getByTestId("content").parentElement
    expect(wrapper).not.toHaveClass("motion-reveal-visible")

    act(() => {
      observerInstances[0]?.trigger(true, wrapper as Element)
    })
    expect(wrapper).toHaveClass("motion-reveal-visible")
  })

  it("applies delay as css variable", () => {
    render(
      <MotionReveal delayMs={140}>
        <div data-testid="content">content</div>
      </MotionReveal>
    )
    const wrapper = screen.getByTestId("content").parentElement
    expect(wrapper?.style.getPropertyValue("--motion-delay")).toBe("140ms")
  })

  it("keeps visible state when once=true after leaving viewport", () => {
    render(
      <MotionReveal once>
        <div data-testid="content">content</div>
      </MotionReveal>
    )
    const wrapper = screen.getByTestId("content").parentElement

    act(() => {
      observerInstances[0]?.trigger(true, wrapper as Element)
    })
    expect(wrapper).toHaveClass("motion-reveal-visible")

    act(() => {
      observerInstances[0]?.trigger(false, wrapper as Element)
    })
    expect(wrapper).toHaveClass("motion-reveal-visible")
  })
})

