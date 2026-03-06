"use client"

import { useEffect, useState } from "react"

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)"

const getInitialReducedMotion = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(MEDIA_QUERY).matches
}

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialReducedMotion)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mediaQuery = window.matchMedia(MEDIA_QUERY)
    const sync = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    sync()
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync)
      return () => {
        mediaQuery.removeEventListener("change", sync)
      }
    }

    mediaQuery.addListener(sync)
    return () => {
      mediaQuery.removeListener(sync)
    }
  }, [])

  return prefersReducedMotion
}

