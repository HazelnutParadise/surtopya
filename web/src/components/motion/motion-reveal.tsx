"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion"

type MotionRevealProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  delayMs?: number
  once?: boolean
  threshold?: number
}

export function MotionReveal({
  children,
  className,
  style,
  delayMs = 0,
  once = true,
  threshold = 0.2,
  ...rest
}: MotionRevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [isVisible, setIsVisible] = useState(prefersReducedMotion)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hasIntersectionObserver =
    typeof window !== "undefined" && typeof IntersectionObserver !== "undefined"
  const shouldShow = prefersReducedMotion || !hasIntersectionObserver || isVisible

  useEffect(() => {
    if (prefersReducedMotion || !hasIntersectionObserver) {
      return
    }

    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry) return

        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.disconnect()
          }
          return
        }

        if (!once) {
          setIsVisible(false)
        }
      },
      { threshold }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [hasIntersectionObserver, once, prefersReducedMotion, threshold])

  return (
    <div
      {...rest}
      ref={containerRef}
      className={cn("motion-reveal", shouldShow && "motion-reveal-visible", className)}
      style={{ ...(style ?? {}), "--motion-delay": `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}
