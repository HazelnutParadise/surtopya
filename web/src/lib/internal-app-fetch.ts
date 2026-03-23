import crypto from "crypto"
import { API_BASE_URL } from "@/lib/api-server"

const INTERNAL_APP_CLOCK_SKEW_SECONDS = 5 * 60
const EMPTY_BODY_BYTES = new Uint8Array()

const getInternalAppSecret = () =>
  process.env.INTERNAL_APP_SIGNING_SECRET?.trim() || process.env.JWT_SECRET?.trim() || ""

const buildInternalCanonical = (
  method: string,
  path: string,
  timestamp: string,
  body: Uint8Array
) => {
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

const encodeStringBody = (body: string) => new TextEncoder().encode(body)

const normalizeBodyForInternalSignature = async (
  method: string,
  body: RequestInit["body"],
  headers: Headers
): Promise<{ bodyBytes: Uint8Array; fetchBody: BodyInit | undefined; headers: Headers }> => {
  if (body == null || method === "GET" || method === "HEAD") {
    return {
      bodyBytes: EMPTY_BODY_BYTES,
      fetchBody: undefined,
      headers,
    }
  }

  if (typeof body === "string") {
    return {
      bodyBytes: encodeStringBody(body),
      fetchBody: body,
      headers,
    }
  }

  if (body instanceof URLSearchParams) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
    }
    const serialized = body.toString()
    return {
      bodyBytes: encodeStringBody(serialized),
      fetchBody: serialized,
      headers,
    }
  }

  if (body instanceof ArrayBuffer) {
    const bytes = new Uint8Array(body)
    return {
      bodyBytes: bytes,
      fetchBody: bytes,
      headers,
    }
  }

  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
    return {
      bodyBytes: bytes,
      fetchBody: bytes,
      headers,
    }
  }

  const request = new Request("http://internal.surtopya.local", {
    method,
    headers,
    body: body as BodyInit,
  })

  const contentType = request.headers.get("Content-Type")
  if (contentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", contentType)
  }

  const bodyBytes = new Uint8Array(await request.arrayBuffer())
  return {
    bodyBytes,
    fetchBody: bodyBytes,
    headers,
  }
}

export const buildInternalAppHeaders = (args: {
  method: string
  path: string
  body?: Uint8Array
  headers?: HeadersInit
}) => {
  const secret = getInternalAppSecret()
  if (!secret) {
    throw new Error("INTERNAL_APP_SIGNING_SECRET is not configured")
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = args.body ?? EMPTY_BODY_BYTES
  const canonical = buildInternalCanonical(args.method, args.path, timestamp, body)
  const signature = signInternalCanonical(secret, canonical)

  const headers = new Headers(args.headers)
  headers.set("X-Surtopya-App-Timestamp", timestamp)
  headers.set("X-Surtopya-App-Signature", signature)
  return headers
}

export const fetchInternalApp = async (path: string | URL, init: RequestInit = {}) => {
  const { pathname, search } = splitInternalPath(path)
  const method = (init.method || "GET").toUpperCase()
  const normalizedBody = await normalizeBodyForInternalSignature(
    method,
    init.body,
    new Headers(init.headers)
  )
  const signedHeaders = buildInternalAppHeaders({
    method,
    path: `/api/app${pathname}`,
    body: normalizedBody.bodyBytes,
    headers: normalizedBody.headers,
  })

  return fetch(`${INTERNAL_APP_BASE_URL}${pathname}${search}`, {
    ...init,
    method,
    headers: signedHeaders,
    body: normalizedBody.fetchBody,
  })
}

export const validateBrowserOrigin = (request: Request) => {
  const configuredBase = process.env.NEXT_PUBLIC_BASE_URL?.trim() || ""
  if (!configuredBase) {
    return false
  }

  let expectedOrigin: string
  try {
    expectedOrigin = new URL(configuredBase).origin
  } catch {
    return false
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
