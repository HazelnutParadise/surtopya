import { UserScope, LogtoNextConfig } from "@logto/next"
import { headers } from "next/headers"

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const resolveConfiguredBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  process.env.PUBLIC_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  ""

const normalizeForwardedValue = (value: string | null) => value?.split(",")[0]?.trim() || ""

const resolveBaseUrl = async () => {
  const configuredBaseUrl = resolveConfiguredBaseUrl()
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl)
  }

  const headerList = await headers()
  const host =
    normalizeForwardedValue(headerList.get("x-forwarded-host")) ||
    normalizeForwardedValue(headerList.get("host"))
  if (host) {
    const proto = normalizeForwardedValue(headerList.get("x-forwarded-proto")) || "http"
    return trimTrailingSlash(`${proto}://${host}`)
  }

  throw new Error(
    "Missing base URL configuration. Set NEXT_PUBLIC_BASE_URL, PUBLIC_BASE_URL, or APP_BASE_URL."
  )
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
