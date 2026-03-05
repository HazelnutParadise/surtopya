export type EffectRouteKey =
  | "home"
  | "about"
  | "pricing"
  | "terms"
  | "privacy"
  | "explore"
  | "datasets"
  | "none"

export type EffectQualityTier = "high" | "medium" | "low"

export interface ThemePalette {
  base: [string, string, string]
  accentPrimary: string
  accentSecondary: string
  glow: string
  line: string
  scan: string
}

export interface EffectSceneConfig {
  routeKey: EffectRouteKey
  tier: EffectQualityTier
  isDark: boolean
  palette: ThemePalette
  prefersReducedMotion: boolean
}

