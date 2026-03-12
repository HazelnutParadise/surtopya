import { NextRequest, NextResponse } from "next/server"
import { locales, resolvePreferredLocale } from "./src/lib/locale"

const getLocaleFromPath = (pathname: string) => {
  const segment = pathname.split("/").filter(Boolean)[0]
  return locales.includes(segment as (typeof locales)[number]) ? segment : null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getLocaleFromPath(pathname)
  const originalPathWithQuery = `${pathname}${request.nextUrl.search}`

  if (locale) {
    const url = request.nextUrl.clone()
    const strippedPath = pathname.replace(`/${locale}`, "") || "/"
    url.pathname = strippedPath

    // Make SSR use the locale from the URL prefix on the first request (no flash of default locale).
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-locale", locale)
    requestHeaders.set("x-return-to", originalPathWithQuery)

    const response = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    })
    response.cookies.set("NEXT_LOCALE", locale, {
      maxAge: 60 * 60 * 24 * 365 * 5,
      path: "/",
    })
    return response
  }

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  const preferredLocale = locales.includes(cookieLocale as (typeof locales)[number])
    ? cookieLocale
    : resolvePreferredLocale(
        (request.headers.get("accept-language") || "")
          .split(",")
          .map((value) => value.split(";")[0]?.trim())
          .filter((value): value is string => Boolean(value))
      )

  const url = request.nextUrl.clone()
  url.pathname = `/${preferredLocale}${pathname === "/" ? "" : pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
}
