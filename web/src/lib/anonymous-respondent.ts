import crypto from "crypto"
import type { NextResponse } from "next/server"

export const ANONYMOUS_RESPONDENT_COOKIE = "surtopya_anonymous_id"

const ANONYMOUS_RESPONDENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2
const ANONYMOUS_RESPONDENT_ID_PATTERN = /^[a-zA-Z0-9_-]{12,128}$/

type CookieReader = {
  get: (name: string) => { value?: string } | undefined
}

const generateAnonymousRespondentID = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const normalizeAnonymousRespondentID = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!ANONYMOUS_RESPONDENT_ID_PATTERN.test(trimmed)) return null
  return trimmed
}

export const resolveAnonymousRespondentID = (cookieStore: CookieReader) => {
  const cookieValue = cookieStore.get(ANONYMOUS_RESPONDENT_COOKIE)?.value
  const existing = normalizeAnonymousRespondentID(cookieValue)
  if (existing) {
    return {
      anonymousId: existing,
      shouldSetCookie: false,
    }
  }

  return {
    anonymousId: generateAnonymousRespondentID(),
    shouldSetCookie: true,
  }
}

export const setAnonymousRespondentCookie = (response: NextResponse, anonymousId: string) => {
  response.cookies.set(ANONYMOUS_RESPONDENT_COOKIE, anonymousId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANONYMOUS_RESPONDENT_COOKIE_MAX_AGE_SECONDS,
  })
}
