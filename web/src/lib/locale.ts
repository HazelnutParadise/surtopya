export const locales = ["zh-TW", "en", "ja"] as const
export const defaultLocale = "zh-TW"

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
