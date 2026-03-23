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
    const context = await getLogtoContext(config)
    if (!context.isAuthenticated) {
      return null
    }

    if (!LOGTO_AUDIENCE) {
      logWarningOnce(
        "missing_logto_audience",
        "[auth] LOGTO_AUDIENCE is empty, requesting Logto default access token resource before local fallback"
      )
    }

    try {
      const token = await getAccessToken(config, LOGTO_AUDIENCE || undefined)
      if (token) {
        logTokenSourceOnce("logto")
        return token
      }
      logTokenSourceOnce(
        "fallback",
        LOGTO_AUDIENCE ? "empty_logto_access_token" : "empty_logto_access_token_default_resource"
      )
    } catch {
      logTokenSourceOnce(
        "fallback",
        LOGTO_AUDIENCE ? "logto_access_token_error" : "logto_access_token_error_default_resource"
      )
    }

    const subject = context.claims?.sub
    if (!subject) {
      logTokenSourceOnce("fallback", "missing_subject_claim")
      return null
    }

    const secret = process.env.JWT_SECRET || "development-secret-key"
    const now = Math.floor(Date.now() / 1000)
    return signJwt(
      {
        sub: subject,
        iat: now,
        exp: now + 60 * 60,
      },
      secret
    )
  } catch (error) {
    console.error("Logto config error:", error)
    return null
  }
}

