import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getLogtoConfig: vi.fn(),
  getLogtoContext: vi.fn(),
  getAccessToken: vi.fn(),
}))

vi.mock("@/lib/logto", () => ({
  getLogtoConfig: mocks.getLogtoConfig,
}))

vi.mock("@logto/next/server-actions", () => ({
  getLogtoContext: mocks.getLogtoContext,
  getAccessToken: mocks.getAccessToken,
}))

describe("getAuthToken", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getLogtoConfig.mockReset()
    mocks.getLogtoContext.mockReset()
    mocks.getAccessToken.mockReset()

    process.env.LOGTO_AUDIENCE = ""
    process.env.JWT_SECRET = "test-secret"
  })

  it("requests a Logto access token even when LOGTO_AUDIENCE is empty", async () => {
    const config = {
      baseUrl: "https://surtopya.com",
    }

    mocks.getLogtoConfig.mockResolvedValue(config)
    mocks.getLogtoContext.mockResolvedValue({
      isAuthenticated: true,
      claims: { sub: "user-1" },
    })
    mocks.getAccessToken.mockResolvedValue("logto-access-token")

    const { getAuthToken } = await import("@/lib/api-server")
    const token = await getAuthToken()

    expect(token).toBe("logto-access-token")
    expect(mocks.getAccessToken).toHaveBeenCalledWith(config, undefined)
  })

  it("passes LOGTO_AUDIENCE to Logto access-token requests when configured", async () => {
    process.env.LOGTO_AUDIENCE = "https://api.surtopya.com"

    const config = {
      baseUrl: "https://surtopya.com",
    }

    mocks.getLogtoConfig.mockResolvedValue(config)
    mocks.getLogtoContext.mockResolvedValue({
      isAuthenticated: true,
      claims: { sub: "user-1" },
    })
    mocks.getAccessToken.mockResolvedValue("logto-access-token")

    const { getAuthToken } = await import("@/lib/api-server")
    const token = await getAuthToken()

    expect(token).toBe("logto-access-token")
    expect(mocks.getAccessToken).toHaveBeenCalledWith(config, "https://api.surtopya.com")
  })
})
