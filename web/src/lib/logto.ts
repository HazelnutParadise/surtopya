import { UserScope, LogtoNextConfig } from "@logto/next"

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const ensureAbsoluteUrl = (value: string, envKey: string) => {
  try {
    new URL(value)
  } catch {
    throw new Error(`Invalid ${envKey}. Set ${envKey} to an absolute URL.`)
  }
}

const resolveBaseUrl = async () => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || ""
  if (!configuredBaseUrl) {
    throw new Error("Missing base URL configuration. Set NEXT_PUBLIC_BASE_URL.")
  }
  ensureAbsoluteUrl(configuredBaseUrl, "NEXT_PUBLIC_BASE_URL")

  return trimTrailingSlash(configuredBaseUrl)
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
