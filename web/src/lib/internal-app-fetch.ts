import crypto from "crypto"
import { API_BASE_URL } from "@/lib/api-server"

const INTERNAL_APP_CLOCK_SKEW_SECONDS = 5 * 60

const getInternalAppSecret = () =>
  process.env.INTERNAL_APP_SIGNING_SECRET?.trim() || process.env.JWT_SECRET?.trim() || ""

const buildInternalCanonical = (method: string, path: string, timestamp: string, body: string) => {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex")
  return [method.toUpperCase(), path, timestamp, bodyHash].join("\n")
}

const signInternalCanonical = (secret: string, canonical: string) =>
  crypto.createHmac("sha256", secret).update(canonical).digest("hex")

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const normalizeInternalPath = (path: string | URL) => {
  if (path instanceof URL) {
    return `${path.pathname}${path.search}`
  }
  return path.startsWith("/") ? path : `/${path}`
}

const splitInternalPath = (path: string | URL) => {
  const normalized = normalizeInternalPath(path)

  try {
    const parsed = new URL(normalized, "http://internal.surtopya.local")
    return {
      pathname: parsed.pathname,
      search: parsed.search,
    }
  } catch {
    const [pathname, ...queryParts] = normalized.split("?")
    return {
      pathname: pathname || "/",
      search: queryParts.length > 0 ? `?${queryParts.join("?")}` : "",
    }
  }
}

const resolveInternalAppBaseUrl = (apiBaseUrl: string) => {
  const trimmed = trimTrailingSlash(apiBaseUrl)

  try {
    const url = new URL(trimmed)
    url.pathname = "/api/app"
    return trimTrailingSlash(url.toString())
  } catch {
    const withoutVersion = trimmed.replace(/\/(?:api\/)?v\d+$/, "")
    if (withoutVersion !== trimmed) {
      return `${withoutVersion}/api/app`
    }
    return `${trimmed}/api/app`
  }
}

const INTERNAL_APP_BASE_URL = resolveInternalAppBaseUrl(API_BASE_URL)

export const buildInternalAppHeaders = (args: {
  method: string
  path: string
  body?: string
  headers?: HeadersInit
}) => {
  const secret = getInternalAppSecret()
  if (!secret) {
    throw new Error("INTERNAL_APP_SIGNING_SECRET is not configured")
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = args.body ?? ""
  const canonical = buildInternalCanonical(args.method, args.path, timestamp, body)
  const signature = signInternalCanonical(secret, canonical)

  const headers = new Headers(args.headers)
  headers.set("X-Surtopya-App-Timestamp", timestamp)
  headers.set("X-Surtopya-App-Signature", signature)
  return headers
}

export const fetchInternalApp = (path: string | URL, init: RequestInit = {}) => {
  const { pathname, search } = splitInternalPath(path)
  const method = (init.method || "GET").toUpperCase()
  const body = typeof init.body === "string" ? init.body : ""
  const signedHeaders = buildInternalAppHeaders({
    method,
    path: `/api/app${pathname}`,
    body,
    headers: init.headers,
  })

  return fetch(`${INTERNAL_APP_BASE_URL}${pathname}${search}`, {
    ...init,
    method,
    headers: signedHeaders,
  })
}

export const validateBrowserOrigin = (request: Request) => {
  const configuredBase =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    ""

  if (!configuredBase) {
    return true
  }

  let expectedOrigin: string
  try {
    expectedOrigin = new URL(configuredBase).origin
  } catch {
    return true
  }

  const origin = request.headers.get("origin")
  if (origin) {
    return origin === expectedOrigin
  }

  const referer = request.headers.get("referer")
  if (!referer) {
    return false
  }

  try {
    return new URL(referer).origin === expectedOrigin
  } catch {
    return false
  }
}

export const isInternalAppTimestampFresh = (timestamp: string) => {
  const parsed = Number(timestamp)
  if (!Number.isFinite(parsed)) {
    return false
  }
  const now = Math.floor(Date.now() / 1000)
  return Math.abs(now - parsed) <= INTERNAL_APP_CLOCK_SKEW_SECONDS
}
