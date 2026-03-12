export const locales = ["zh-TW", "en", "ja"] as const
export const defaultLocale = "en"
export const detectedLocaleFallback = "en"

export const matchSupportedLocale = (value?: string | null) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  const exact = locales.find((locale) => locale.toLowerCase() === normalized)
  if (exact) return exact
  if (normalized.startsWith("zh")) return "zh-TW"
  if (normalized.startsWith("ja")) return "ja"
  if (normalized.startsWith("en")) return "en"
  return null
}

export const resolvePreferredLocale = (candidates: Iterable<string>) => {
  for (const candidate of candidates) {
    const matched = matchSupportedLocale(candidate)
    if (matched) return matched
  }
  return detectedLocaleFallback
}

export const detectBrowserLocale = () => {
  if (typeof navigator === "undefined") return detectedLocaleFallback

  const candidates =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language]

  return resolvePreferredLocale(
    candidates.filter((value): value is string => typeof value === "string")
  )
}

export const getLocaleFromPath = (pathname: string) => {
  const segment = pathname.split("/").filter(Boolean)[0]
  return locales.includes(segment as (typeof locales)[number]) ? segment : defaultLocale
}

export const withLocale = (path: string, locale: string) => {
  const safeLocale = locales.includes(locale as (typeof locales)[number]) ? locale : defaultLocale
  const [pathname, query] = path.split("?")
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  const segments = normalizedPath.split("/").filter(Boolean)
  if (segments.length === 0) {
    return `/${safeLocale}`
  }
  if (locales.includes(segments[0] as (typeof locales)[number])) {
    segments[0] = safeLocale
  } else {
    segments.unshift(safeLocale)
  }
  const nextPath = `/${segments.join("/")}`
  return query ? `${nextPath}?${query}` : nextPath
}
