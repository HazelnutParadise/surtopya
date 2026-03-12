import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"
import { defaultLocale, locales } from "@/lib/locale"
import { DEFAULT_TIME_ZONE, isValidIanaTimeZone } from "@/lib/date-time"
import { LOCALE_COOKIE_NAME, TIME_ZONE_COOKIE_NAME } from "@/lib/user-settings"
import type { NextRequest } from "next/server"

type RouteUserSettings = {
  locale: string
  timeZone: string
  settingsAutoInitialized: boolean
}

const isSupportedLocale = (value: unknown): value is string => {
  return typeof value === "string" && locales.includes(value as (typeof locales)[number])
}

const getCookieLocale = (request: NextRequest) => {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value
  return isSupportedLocale(cookieLocale) ? cookieLocale : defaultLocale
}

const getCookieTimeZone = (request: NextRequest) => {
  const cookieTimeZone = request.cookies.get(TIME_ZONE_COOKIE_NAME)?.value
  if (typeof cookieTimeZone === "string" && isValidIanaTimeZone(cookieTimeZone)) {
    return cookieTimeZone
  }

  return DEFAULT_TIME_ZONE
}

const getGuestSettings = (request: NextRequest): RouteUserSettings => ({
  locale: getCookieLocale(request),
  timeZone: getCookieTimeZone(request),
  settingsAutoInitialized: true,
})

const normalizeUpstreamSettings = (
  payload: unknown,
  request: NextRequest
): RouteUserSettings => {
  const source = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {}
  const timeZoneValue = source.timeZone
  const localeValue = source.locale
  return {
    locale: isSupportedLocale(localeValue) ? localeValue : getCookieLocale(request),
    timeZone:
      typeof timeZoneValue === "string" && isValidIanaTimeZone(timeZoneValue)
        ? timeZoneValue
        : getCookieTimeZone(request),
    settingsAutoInitialized:
      typeof source.settingsAutoInitialized === "boolean" ? source.settingsAutoInitialized : false,
  }
}

const setSettingsCookies = (response: NextResponse, locale: string, timeZone: string) => {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  response.cookies.set(TIME_ZONE_COOKIE_NAME, timeZone, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json(getGuestSettings(request))
  }

  const response = await fetch(`${API_BASE_URL}/me/settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (response.status === 401) {
    return NextResponse.json(getGuestSettings(request))
  }
  const settings = normalizeUpstreamSettings(payload, request)
  const nextResponse = NextResponse.json({ ...payload, ...settings }, { status: response.status })
  setSettingsCookies(nextResponse, settings.locale, settings.timeZone)
  return nextResponse
}

export async function PATCH(request: NextRequest) {
  const token = await getAuthToken()
  const body = await request.json().catch(() => ({}))
  const requestedLocale = isSupportedLocale(body?.locale) ? body.locale : null
  const requestedTimeZone = isValidIanaTimeZone(body?.timeZone) ? body.timeZone : null

  if (!token) {
    if ((body?.locale != null && !requestedLocale) || (body?.timeZone != null && !requestedTimeZone)) {
      return NextResponse.json(
        { error: "locale/timeZone is invalid" },
        { status: 400 }
      )
    }

    const nextLocale = requestedLocale || getCookieLocale(request)
    const nextTimeZone = requestedTimeZone || getCookieTimeZone(request)
    const response = NextResponse.json({
      locale: nextLocale,
      timeZone: nextTimeZone,
      settingsAutoInitialized: true,
    })
    setSettingsCookies(response, nextLocale, nextTimeZone)
    return response
  }
  const response = await fetch(`${API_BASE_URL}/me/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  if (response.status === 401 && (requestedLocale || requestedTimeZone)) {
    const nextLocale = requestedLocale || getCookieLocale(request)
    const nextTimeZone = requestedTimeZone || getCookieTimeZone(request)
    const fallback = NextResponse.json({
      locale: nextLocale,
      timeZone: nextTimeZone,
      settingsAutoInitialized: true,
    })
    setSettingsCookies(fallback, nextLocale, nextTimeZone)
    return fallback
  }
  const settings = normalizeUpstreamSettings(payload, request)
  const nextLocale = settings.locale
  const nextTimeZone = settings.timeZone
  const nextResponse = NextResponse.json({ ...payload, ...settings }, { status: response.status })
  if (response.ok) {
    setSettingsCookies(nextResponse, nextLocale, nextTimeZone)
  }
  return nextResponse
}
