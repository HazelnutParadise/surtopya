import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}))

const REQUIRED_ENV_KEYS = [
  "LOGTO_ENDPOINT",
  "LOGTO_APP_ID",
  "LOGTO_APP_SECRET",
  "LOGTO_COOKIE_SECRET",
] as const

const BASE_URL_ENV_KEYS = ["NEXT_PUBLIC_BASE_URL", "PUBLIC_BASE_URL", "APP_BASE_URL"] as const

const setRequiredLogtoEnv = () => {
  process.env.LOGTO_ENDPOINT = "https://auth.example.com/oidc"
  process.env.LOGTO_APP_ID = "app-id"
  process.env.LOGTO_APP_SECRET = "app-secret"
  process.env.LOGTO_COOKIE_SECRET = "cookie-secret"
}

const setHeaderValues = (values: Record<string, string | null>) => {
  mocks.headers.mockResolvedValue({
    get: (key: string) => values[key] ?? null,
  })
}

describe("getLogtoConfig", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.headers.mockReset()

    for (const key of REQUIRED_ENV_KEYS) {
      delete process.env[key]
    }
    for (const key of BASE_URL_ENV_KEYS) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prefers configured base URL env over forwarded host headers", async () => {
    setRequiredLogtoEnv()
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.surtopya.com/"
    setHeaderValues({
      "x-forwarded-host": "preview.surtopya.dev",
      "x-forwarded-proto": "https",
    })

    const { getLogtoConfig } = await import("@/lib/logto")
    const config = await getLogtoConfig()

    expect(config.baseUrl).toBe("https://app.surtopya.com")
    expect(config.cookieSecure).toBe(true)
  })

  it("uses forwarded headers when base URL env is not configured", async () => {
    setRequiredLogtoEnv()
    setHeaderValues({
      "x-forwarded-host": "prod.surtopya.com",
      "x-forwarded-proto": "https",
    })

    const { getLogtoConfig } = await import("@/lib/logto")
    const config = await getLogtoConfig()

    expect(config.baseUrl).toBe("https://prod.surtopya.com")
    expect(config.cookieSecure).toBe(true)
  })

  it("normalizes multi-hop forwarded headers by taking the first value", async () => {
    setRequiredLogtoEnv()
    setHeaderValues({
      "x-forwarded-host": "prod.surtopya.com, internal-gateway.local",
      "x-forwarded-proto": "https, http",
    })

    const { getLogtoConfig } = await import("@/lib/logto")
    const config = await getLogtoConfig()

    expect(config.baseUrl).toBe("https://prod.surtopya.com")
  })

  it("throws a clear error when no base URL can be resolved", async () => {
    setRequiredLogtoEnv()
    setHeaderValues({})

    const { getLogtoConfig } = await import("@/lib/logto")

    await expect(getLogtoConfig()).rejects.toThrow(
      "Missing base URL configuration. Set NEXT_PUBLIC_BASE_URL, PUBLIC_BASE_URL, or APP_BASE_URL."
    )
  })
})
