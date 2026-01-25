import { UserScope, LogtoNextConfig } from "@logto/next"
import { headers } from "next/headers"

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const resolveBaseUrl = async () => {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") || headerList.get("host")
  if (host) {
    const proto = headerList.get("x-forwarded-proto") || "http"
    return `${proto}://${host}`
  }

  return requiredEnv("NEXT_PUBLIC_BASE_URL")
}

const resolveCookieSecure = (baseUrl: string) => baseUrl.startsWith("https://")

export const getLogtoConfig = async (): Promise<LogtoNextConfig> => {
  const baseUrl = await resolveBaseUrl()
  return {
    endpoint: requiredEnv("LOGTO_ENDPOINT"),
    appId: requiredEnv("LOGTO_APP_ID"),
    appSecret: requiredEnv("LOGTO_APP_SECRET"),
    baseUrl,
    cookieSecret: requiredEnv("LOGTO_COOKIE_SECRET"),
    cookieSecure: resolveCookieSecure(baseUrl),
    scopes: [UserScope.Email, UserScope.Profile],
  }
}
