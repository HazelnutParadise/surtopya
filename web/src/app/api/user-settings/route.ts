import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"
import { defaultLocale, locales } from "@/lib/locale"
import type { NextRequest } from "next/server"

const isSupportedLocale = (value: unknown): value is string => {
  return typeof value === "string" && locales.includes(value as (typeof locales)[number])
}

const getCookieLocale = (request: NextRequest) => {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  return isSupportedLocale(cookieLocale) ? cookieLocale : defaultLocale
}

export async function GET(request: NextRequest) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ locale: getCookieLocale(request) })
  }

  const response = await fetch(`${API_BASE_URL}/me/settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (response.status === 401) {
    return NextResponse.json({ locale: getCookieLocale(request) })
  }
  return NextResponse.json(payload, { status: response.status })
}

export async function PATCH(request: NextRequest) {
  const token = await getAuthToken()
  const body = await request.json().catch(() => ({}))
  const requestedLocale = isSupportedLocale(body?.locale) ? body.locale : null

  if (!token) {
    if (!requestedLocale) {
      return NextResponse.json(
        { error: "locale is required and must be one of zh-TW, en, ja" },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ locale: requestedLocale })
    response.cookies.set("NEXT_LOCALE", requestedLocale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
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
  if (response.status === 401 && requestedLocale) {
    const fallback = NextResponse.json({ locale: requestedLocale })
    fallback.cookies.set("NEXT_LOCALE", requestedLocale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
    return fallback
  }
  return NextResponse.json(payload, { status: response.status })
}
