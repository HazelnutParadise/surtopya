"use client"

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion"

type PageMotionShellProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function PageMotionShell({ children, className, ...rest }: PageMotionShellProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [isEntered, setIsEntered] = useState(false)

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsEntered(true)
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  const shouldShowEnteredState = prefersReducedMotion || isEntered

  return (
    <div
      {...rest}
      className={cn(
        "motion-page-enter",
        shouldShowEnteredState && "motion-page-enter-visible",
        className
      )}
    >
      {children}
    </div>
  )
}
