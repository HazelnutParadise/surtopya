import { NextResponse } from "next/server"
import { fetchInternalApp, validateBrowserOrigin } from "@/lib/internal-app-fetch"

const ANONYMOUS_SUBMIT_WINDOW_MS = 60_000
const ANONYMOUS_SUBMIT_MAX_PER_WINDOW = 12

type AnonymousRateState = {
  count: number
  resetAt: number
}

const anonymousRateMap = new Map<string, AnonymousRateState>()

const getClientIP = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }

  const realIP = request.headers.get("x-real-ip")?.trim()
  if (realIP) return realIP

  return "unknown"
}

const consumeAnonymousSubmitQuota = (key: string) => {
  const now = Date.now()
  const current = anonymousRateMap.get(key)
  if (!current || now >= current.resetAt) {
    anonymousRateMap.set(key, {
      count: 1,
      resetAt: now + ANONYMOUS_SUBMIT_WINDOW_MS,
    })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= ANONYMOUS_SUBMIT_MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return { allowed: false, retryAfterSeconds }
  }

  current.count += 1
  anonymousRateMap.set(key, current)
  return { allowed: true, retryAfterSeconds: 0 }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!validateBrowserOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 })
  }

  const ip = getClientIP(request)
  const quota = consumeAnonymousSubmitQuota(`${id}:${ip}`)
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: quota.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      }
    )
  }

  const body = await request.json().catch(() => ({}))

  const response = await fetchInternalApp(`/surveys/${id}/responses/submit-anonymous`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
