import { getAccessToken, getLogtoContext } from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"
import crypto from "crypto"

export const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.PUBLIC_API_URL ||
  "http://api:8080/v1"

const LOGTO_AUDIENCE = process.env.LOGTO_AUDIENCE?.trim() || ""

const loggedTokenSources = new Set<string>()
const loggedWarnings = new Set<string>()

const logTokenSourceOnce = (source: "logto" | "fallback", reason?: string) => {
  if (loggedTokenSources.has(source)) {
    return
  }

  loggedTokenSources.add(source)
  if (source === "logto") {
    console.info("[auth] token_source=logto")
    return
  }

  const suffix = reason ? ` reason=${reason}` : ""
  console.warn(`[auth] token_source=fallback${suffix}`)
}

const logWarningOnce = (key: string, message: string) => {
  if (loggedWarnings.has(key)) {
    return
  }
  loggedWarnings.add(key)
  console.warn(message)
}

const base64UrlEncode = (input: Buffer | string) => {
  const buffer = typeof input === "string" ? Buffer.from(input) : input
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".")
  if (parts.length < 2) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const getJwtStringClaim = (token: string, key: string) => {
  const payload = decodeJwtPayload(token)
  const value = payload?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

const getRecordString = (record: unknown, key: string) => {
  if (!record || typeof record !== "object") {
    return null
  }
  const value = (record as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

const resolveUsernameFromContext = (context: unknown) => {
  if (!context || typeof context !== "object") {
    return null
  }

  const record = context as Record<string, unknown>
  const fromUserInfo = getRecordString(record.userInfo, "username")
  if (fromUserInfo) {
    return fromUserInfo
  }
  return getRecordString(record.claims, "username")
}

const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const header = { alg: "HS256", typ: "JWT" }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac("sha256", secret).update(data).digest()
  return `${data}.${base64UrlEncode(signature)}`
}

export const getAuthToken = async () => {
  try {
    const config = await getLogtoConfig()
    const context = await getLogtoContext(config, { fetchUserInfo: true })
    if (!context.isAuthenticated) {
      return null
    }
    const username = resolveUsernameFromContext(context)

    if (LOGTO_AUDIENCE) {
      try {
        const token = await getAccessToken(config, LOGTO_AUDIENCE)
        if (token) {
          if (getJwtStringClaim(token, "username")) {
            logTokenSourceOnce("logto")
            return token
          }
          logTokenSourceOnce("fallback", "missing_username_in_access_token")
        }
        if (!token) {
          logTokenSourceOnce("fallback", "empty_logto_access_token")
        }
      } catch {
        logTokenSourceOnce("fallback", "logto_access_token_error")
      }
    } else {
      logWarningOnce(
        "missing_logto_audience",
        "[auth] LOGTO_AUDIENCE is empty, skipping Logto access-token request and using local fallback"
      )
      logTokenSourceOnce("fallback", "missing_logto_audience")
    }

    const subject = context.claims?.sub
    if (!subject) {
      logTokenSourceOnce("fallback", "missing_subject_claim")
      return null
    }

    const secret = process.env.JWT_SECRET || "development-secret-key"
    const now = Math.floor(Date.now() / 1000)
    const payload: Record<string, unknown> = {
      sub: subject,
      iat: now,
      exp: now + 60 * 60,
    }
    if (username) {
      payload.username = username
    }

    return signJwt(
      payload,
      secret
    )
  } catch (error) {
    console.error("Logto config error:", error)
    return null
  }
}

