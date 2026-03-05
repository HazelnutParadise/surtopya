"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { resolveEffectRoute } from "@/lib/effects-route"
import { EffectSceneRenderer } from "./EffectSceneRenderer"
import { resolveEffectQualityTier } from "./quality-tier"
import { StaticFallbackBackground } from "./StaticFallbackBackground"
import type { EffectQualityTier, EffectRouteKey, ThemePalette } from "./types"

const getThemePalette = (isDark: boolean): ThemePalette => {
  if (isDark) {
    return {
      base: ["#0f1021", "#2b174f", "#7a2e7a"],
      accentPrimary: "#b86cff",
      accentSecondary: "#f472b6",
      glow: "#d7a6ff",
      line: "#8f6dd8",
      scan: "#f3a2e0",
    }
  }

  return {
    base: ["#f6f2ff", "#ede5ff", "#f6e9fb"],
    accentPrimary: "#8f58dc",
    accentSecondary: "#cc5ea2",
    glow: "#a97adf",
    line: "#b8a4d9",
    scan: "#c58abc",
  }
}

const hasWebGLSupport = () => {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

const resolveDarkMode = () => {
  if (typeof document === "undefined") return false
  const hasDarkClass = document.documentElement.classList.contains("dark")
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return hasDarkClass || prefersDark
}

export function SiteEffectsLayer() {
  const pathname = usePathname()
  const routeKey = useMemo<EffectRouteKey>(() => resolveEffectRoute(pathname || "/"), [pathname])

  const [qualityTier, setQualityTier] = useState<EffectQualityTier>("low")
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isWebGLReady, setIsWebGLReady] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const syncReducedMotion = () => {
      setPrefersReducedMotion(media.matches)
    }
    syncReducedMotion()

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncReducedMotion)
      return () => {
        media.removeEventListener("change", syncReducedMotion)
      }
    }

    media.addListener(syncReducedMotion)
    return () => {
      media.removeListener(syncReducedMotion)
    }
  }, [])

  useEffect(() => {
    const syncCapabilities = () => {
      const nav = window.navigator as Navigator & { deviceMemory?: number }
      setQualityTier(
        resolveEffectQualityTier({
          viewportWidth: window.innerWidth,
          hardwareConcurrency: nav.hardwareConcurrency,
          deviceMemory: nav.deviceMemory,
        })
      )
      setIsWebGLReady(hasWebGLSupport())
    }

    syncCapabilities()
    window.addEventListener("resize", syncCapabilities)
    return () => {
      window.removeEventListener("resize", syncCapabilities)
    }
  }, [])

  useEffect(() => {
    const colorMedia = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => {
      setIsDarkMode(resolveDarkMode())
    }

    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    if (typeof colorMedia.addEventListener === "function") {
      colorMedia.addEventListener("change", syncTheme)
      return () => {
        colorMedia.removeEventListener("change", syncTheme)
        observer.disconnect()
      }
    }

    colorMedia.addListener(syncTheme)
    return () => {
      colorMedia.removeListener(syncTheme)
      observer.disconnect()
    }
  }, [])

  if (routeKey === "none") {
    return null
  }

  const palette = getThemePalette(isDarkMode)
  if (prefersReducedMotion || !isWebGLReady) {
    return <StaticFallbackBackground routeKey={routeKey} palette={palette} />
  }

  return (
    <EffectSceneRenderer
      routeKey={routeKey}
      tier={qualityTier}
      palette={palette}
    />
  )
}

