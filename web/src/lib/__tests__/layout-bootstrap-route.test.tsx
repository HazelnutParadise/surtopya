import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  fetchInternalApp: vi.fn(),
  getLogtoConfig: vi.fn(),
  getLogtoContext: vi.fn(),
  redirect: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}))

vi.mock("@/lib/internal-app-fetch", () => ({
  fetchInternalApp: mocks.fetchInternalApp,
}))

vi.mock("@/lib/logto", () => ({
  getLogtoConfig: mocks.getLogtoConfig,
}))

vi.mock("@logto/next/server-actions", () => ({
  getLogtoContext: mocks.getLogtoContext,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("fs/promises", () => ({
  default: {
    readFile: mocks.readFile,
  },
  readFile: mocks.readFile,
}))

import RootLayout from "@/app/layout"

describe("RootLayout bootstrap fetch", () => {
  const originalRequireBootstrapAuth = process.env.REQUIRE_BOOTSTRAP_AUTH

  beforeEach(() => {
    mocks.headers.mockReset()
    mocks.cookies.mockReset()
    mocks.fetchInternalApp.mockReset()
    mocks.getLogtoConfig.mockReset()
    mocks.getLogtoContext.mockReset()
    mocks.redirect.mockReset()
    mocks.readFile.mockReset()

    mocks.headers.mockResolvedValue({
      get: () => null,
    })
    mocks.cookies.mockResolvedValue({
      get: () => undefined,
    })
    mocks.readFile.mockResolvedValue("{}")
    mocks.getLogtoConfig.mockResolvedValue({})
    mocks.getLogtoContext.mockResolvedValue({ isAuthenticated: false })
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ hasSuperAdmin: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalRequireBootstrapAuth === undefined) {
      delete process.env.REQUIRE_BOOTSTRAP_AUTH
    } else {
      process.env.REQUIRE_BOOTSTRAP_AUTH = originalRequireBootstrapAuth
    }
  })

  it("loads bootstrap status via internal app endpoint", async () => {
    process.env.REQUIRE_BOOTSTRAP_AUTH = "false"

    await RootLayout({ children: <div>child</div> })

    expect(mocks.fetchInternalApp).toHaveBeenCalledWith(
      "/bootstrap",
      expect.objectContaining({ cache: "no-store" })
    )
  })

  it("redirects to sign-in when bootstrap auth is required and no super admin exists", async () => {
    process.env.REQUIRE_BOOTSTRAP_AUTH = "true"
    mocks.fetchInternalApp.mockResolvedValue(
      new Response(JSON.stringify({ hasSuperAdmin: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    mocks.getLogtoContext.mockResolvedValue({ isAuthenticated: false })

    await RootLayout({ children: <div>child</div> })

    expect(mocks.redirect).toHaveBeenCalledWith("/api/logto/sign-in")
  })
})
