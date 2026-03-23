import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  getLogtoConfig: vi.fn(),
  handleSignIn: vi.fn(),
  handleSignOut: vi.fn(),
  handleSignInCallback: vi.fn(),
}))

vi.mock("@/lib/logto", () => ({
  getLogtoConfig: mocks.getLogtoConfig,
}))

vi.mock("@logto/next/server-actions", () => ({
  default: vi.fn().mockImplementation(() => ({
    handleSignIn: mocks.handleSignIn,
    handleSignOut: mocks.handleSignOut,
    handleSignInCallback: mocks.handleSignInCallback,
  })),
}))

import { GET } from "@/app/api/logto/[action]/route"

const asNextRequest = (
  url: string,
  headers: Record<string, string>,
  cookieValues: Record<string, string> = {}
) =>
  ({
    url,
    nextUrl: new URL(url),
    headers: new Headers(headers),
    cookies: {
      get: (name: string) => {
        const value = cookieValues[name]
        return value ? { value } : undefined
      },
    },
  }) as unknown as NextRequest

describe("GET /api/logto/[action]", () => {
  beforeEach(() => {
    mocks.getLogtoConfig.mockReset()
    mocks.handleSignIn.mockReset()
    mocks.handleSignOut.mockReset()
    mocks.handleSignInCallback.mockReset()
    process.env.NEXT_PUBLIC_BASE_URL = "https://surtopya.com"
  })

  it("redirects auth configuration failures to NEXT_PUBLIC_BASE_URL", async () => {
    mocks.getLogtoConfig.mockRejectedValue(new Error("missing_logto_env"))

    const request = asNextRequest("http://localhost:3000/api/logto/sign-in", {
      host: "localhost:3000",
    })

    const response = await GET(request, {
      params: Promise.resolve({ action: "sign-in" }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://surtopya.com/?authError=logto_configuration"
    )
  })

  it("uses public base URL for callback verification behind proxy", async () => {
    mocks.getLogtoConfig.mockResolvedValue({
      baseUrl: "https://surtopya.com",
    })
    mocks.handleSignInCallback.mockResolvedValue(undefined)

    const request = asNextRequest("http://localhost:3000/api/logto/sign-in-callback?code=abc&state=xyz", {
      host: "localhost:3000",
      "x-forwarded-host": "surtopya.com",
      "x-forwarded-proto": "https",
    })

    const response = await GET(request, {
      params: Promise.resolve({ action: "sign-in-callback" }),
    })

    expect(mocks.handleSignInCallback).toHaveBeenCalledWith(
      "https://surtopya.com/api/logto/sign-in-callback?code=abc&state=xyz"
    )
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://surtopya.com/")
  })
})
