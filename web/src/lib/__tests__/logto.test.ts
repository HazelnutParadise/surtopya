import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const REQUIRED_ENV_KEYS = [
  "LOGTO_ENDPOINT",
  "LOGTO_APP_ID",
  "LOGTO_APP_SECRET",
  "LOGTO_COOKIE_SECRET",
] as const

const setRequiredLogtoEnv = () => {
  process.env.LOGTO_ENDPOINT = "https://auth.example.com/oidc"
  process.env.LOGTO_APP_ID = "app-id"
  process.env.LOGTO_APP_SECRET = "app-secret"
  process.env.LOGTO_COOKIE_SECRET = "cookie-secret"
}

describe("getLogtoConfig", () => {
  beforeEach(() => {
    vi.resetModules()

    for (const key of REQUIRED_ENV_KEYS) {
      delete process.env[key]
    }
    delete process.env.NEXT_PUBLIC_BASE_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses NEXT_PUBLIC_BASE_URL and trims trailing slash", async () => {
    setRequiredLogtoEnv()
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.surtopya.com/"

    const { getLogtoConfig } = await import("@/lib/logto")
    const config = await getLogtoConfig()

    expect(config.baseUrl).toBe("https://app.surtopya.com")
    expect(config.cookieSecure).toBe(true)
  })

  it("sets cookieSecure false for non-https base URL", async () => {
    setRequiredLogtoEnv()
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000"

    const { getLogtoConfig } = await import("@/lib/logto")
    const config = await getLogtoConfig()

    expect(config.baseUrl).toBe("http://localhost:3000")
    expect(config.cookieSecure).toBe(false)
  })

  it("throws a clear error when NEXT_PUBLIC_BASE_URL is missing", async () => {
    setRequiredLogtoEnv()
    const { getLogtoConfig } = await import("@/lib/logto")

    await expect(getLogtoConfig()).rejects.toThrow(
      "Missing base URL configuration. Set NEXT_PUBLIC_BASE_URL."
    )
  })

  it("throws a clear error when NEXT_PUBLIC_BASE_URL is invalid", async () => {
    setRequiredLogtoEnv()
    process.env.NEXT_PUBLIC_BASE_URL = "not-a-url"

    const { getLogtoConfig } = await import("@/lib/logto")

    await expect(getLogtoConfig()).rejects.toThrow(
      "Invalid NEXT_PUBLIC_BASE_URL. Set NEXT_PUBLIC_BASE_URL to an absolute URL."
    )
  })
})
