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

const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase()
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1"
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

const resolveBaseUrl = async () => {
  const headerList = await headers()
  const forwardedHost =
    normalizeForwardedValue(headerList.get("x-forwarded-host")) ||
    ""
  const host = forwardedHost || normalizeForwardedValue(headerList.get("host"))
  const proto = normalizeForwardedValue(headerList.get("x-forwarded-proto")) || "http"
  const headerResolvedBaseUrl = host ? trimTrailingSlash(`${proto}://${host}`) : ""

  const configuredBaseUrl = resolveConfiguredBaseUrl()
  if (configuredBaseUrl) {
    const configuredHostname = getHostname(configuredBaseUrl)
    const headerHostname = getHostname(headerResolvedBaseUrl)
    if (
      configuredHostname &&
      headerHostname &&
      isLoopbackHostname(configuredHostname) &&
      !isLoopbackHostname(headerHostname)
    ) {
      console.warn(
        `[auth] Ignoring loopback configured base URL "${configuredBaseUrl}" in favor of forwarded host "${headerResolvedBaseUrl}"`
      )
      return headerResolvedBaseUrl
    }

    return trimTrailingSlash(configuredBaseUrl)
  }

  if (headerResolvedBaseUrl) {
    return headerResolvedBaseUrl
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
