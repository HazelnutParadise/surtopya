"use client"

import type { EffectRouteKey, ThemePalette } from "./types"

interface StaticFallbackBackgroundProps {
  routeKey: EffectRouteKey
  palette: ThemePalette
}

export function StaticFallbackBackground({ routeKey, palette }: StaticFallbackBackgroundProps) {
  const routeOverlayByKey: Record<EffectRouteKey, string> = {
    home: "radial-gradient(80% 80% at 15% 15%, rgba(184,108,255,0.22), transparent 60%)",
    about: "radial-gradient(70% 70% at 70% 20%, rgba(167,139,250,0.16), transparent 62%)",
    pricing: "radial-gradient(75% 75% at 82% 18%, rgba(244,114,182,0.2), transparent 60%)",
    terms: "linear-gradient(180deg, rgba(120,90,180,0.1), rgba(20,24,39,0.05))",
    privacy: "linear-gradient(180deg, rgba(120,90,180,0.1), rgba(20,24,39,0.05))",
    explore: "radial-gradient(90% 60% at 50% 25%, rgba(190,130,255,0.16), transparent 68%)",
    datasets: "radial-gradient(100% 70% at 35% 18%, rgba(244,114,182,0.16), transparent 66%)",
    none: "none",
  }

  const baseGradient = `linear-gradient(160deg, ${palette.base[0]} 0%, ${palette.base[1]} 55%, ${palette.base[2]} 100%)`

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden data-testid="site-effects-fallback">
      <div className="h-full w-full opacity-95" style={{ backgroundImage: `${routeOverlayByKey[routeKey]}, ${baseGradient}` }} />
    </div>
  )
}

