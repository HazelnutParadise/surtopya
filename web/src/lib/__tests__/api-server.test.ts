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

const encodeBase64Url = (input: string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

const buildJwtForTest = (payload: Record<string, unknown>) => {
  const header = encodeBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }))
  const body = encodeBase64Url(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const [, payload] = token.split(".")
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return JSON.parse(Buffer.from(`${normalized}${padding}`, "base64").toString("utf8"))
}

describe("getAuthToken", () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getLogtoConfig.mockReset()
    mocks.getLogtoContext.mockReset()
    mocks.getAccessToken.mockReset()
    process.env.LOGTO_AUDIENCE = "https://api.surtopya.local"
    process.env.JWT_SECRET = "unit-test-secret"
  })

  it("uses Logto access token when the token already includes username", async () => {
    const accessToken = buildJwtForTest({
      sub: "logto|user-1",
      username: "alice",
    })
    mocks.getLogtoConfig.mockResolvedValue({ endpoint: "https://logto.local" })
    mocks.getLogtoContext.mockResolvedValue({
      isAuthenticated: true,
      claims: { sub: "logto|user-1" },
      userInfo: { username: "alice" },
    })
    mocks.getAccessToken.mockResolvedValue(accessToken)

    const { getAuthToken } = await import("@/lib/api-server")
    const token = await getAuthToken()

    expect(token).toBe(accessToken)
    expect(mocks.getLogtoContext).toHaveBeenCalledWith(
      expect.anything(),
      { fetchUserInfo: true }
    )
  })

  it("falls back to locally signed token when access token has no username claim", async () => {
    const accessTokenWithoutUsername = buildJwtForTest({
      sub: "logto|user-1",
    })
    mocks.getLogtoConfig.mockResolvedValue({ endpoint: "https://logto.local" })
    mocks.getLogtoContext.mockResolvedValue({
      isAuthenticated: true,
      claims: { sub: "logto|user-1" },
      userInfo: { username: "alice" },
    })
    mocks.getAccessToken.mockResolvedValue(accessTokenWithoutUsername)

    const { getAuthToken } = await import("@/lib/api-server")
    const token = await getAuthToken()

    expect(token).toBeTruthy()
    expect(token).not.toBe(accessTokenWithoutUsername)
    const payload = decodeJwtPayload(token as string)
    expect(payload.sub).toBe("logto|user-1")
    expect(payload.username).toBe("alice")
  })

  it("fallback token still carries username when Logto access token request fails", async () => {
    mocks.getLogtoConfig.mockResolvedValue({ endpoint: "https://logto.local" })
    mocks.getLogtoContext.mockResolvedValue({
      isAuthenticated: true,
      claims: { sub: "logto|user-1" },
      userInfo: { username: "alice" },
    })
    mocks.getAccessToken.mockRejectedValue(new Error("token_error"))

    const { getAuthToken } = await import("@/lib/api-server")
    const token = await getAuthToken()

    expect(token).toBeTruthy()
    const payload = decodeJwtPayload(token as string)
    expect(payload.sub).toBe("logto|user-1")
    expect(payload.username).toBe("alice")
  })
})

