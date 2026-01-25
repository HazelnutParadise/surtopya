import { getAccessToken, getLogtoContext } from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"
import crypto from "crypto"

export const API_BASE_URL = process.env.PUBLIC_API_URL || "http://localhost:8080/api/v1"

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

    try {
      const token = await getAccessToken(config, API_BASE_URL)
      if (token) {
        return token
      }
    } catch {
      // fallback to local JWT
    }

    const subject = context.claims?.sub
    if (!subject) {
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
