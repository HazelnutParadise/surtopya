import { locales } from "@/lib/locale"
import type { EffectRouteKey } from "@/components/effects/types"

const ENABLED_ROUTES: Record<string, EffectRouteKey> = {
  "/about": "about",
  "/pricing": "pricing",
  "/terms": "terms",
  "/privacy": "privacy",
  "/explore": "explore",
  "/datasets": "datasets",
}

const DISABLED_PREFIXES = ["/create", "/dashboard", "/admin", "/survey", "/api"]

export const normalizeLocalePath = (pathname: string) => {
  if (!pathname) return "/"
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "/"
  const segments = withoutQuery.split("/").filter(Boolean)

  if (segments.length === 0) {
    return "/"
  }

  if (locales.includes(segments[0] as (typeof locales)[number])) {
    segments.shift()
  }

  const normalized = `/${segments.join("/")}`
  return normalized === "/" ? "/" : normalized.replace(/\/+$/, "") || "/"
}

export const resolveEffectRoute = (pathname: string): EffectRouteKey => {
  const normalizedPath = normalizeLocalePath(pathname)

  if (normalizedPath.startsWith("/datasets/")) {
    return "none"
  }

  if (DISABLED_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return "none"
  }

  return ENABLED_ROUTES[normalizedPath] ?? "none"
}
