import { UserScope, LogtoNextConfig } from "@logto/next"

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const getLogtoConfig = (): LogtoNextConfig => ({
  endpoint: requiredEnv("LOGTO_ENDPOINT"),
  appId: requiredEnv("LOGTO_APP_ID"),
  appSecret: requiredEnv("LOGTO_APP_SECRET"),
  baseUrl: requiredEnv("NEXT_PUBLIC_BASE_URL"),
  cookieSecret: requiredEnv("LOGTO_COOKIE_SECRET"),
  cookieSecure: process.env.NODE_ENV === "production",
  scopes: [UserScope.Email, UserScope.Profile],
})
