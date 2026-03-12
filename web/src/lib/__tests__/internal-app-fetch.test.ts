import crypto from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api-server", () => ({
  API_BASE_URL: "http://api:8080/api/v1",
}))

const signCanonical = (secret: string, method: string, path: string, timestamp: string, body: string) => {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex")
  const canonical = [method.toUpperCase(), path, timestamp, bodyHash].join("\n")
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex")
}

describe("fetchInternalApp", () => {
  const originalSecret = process.env.INTERNAL_APP_SIGNING_SECRET

  beforeEach(() => {
    vi.resetModules()
    process.env.INTERNAL_APP_SIGNING_SECRET = "unit-test-secret"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    if (originalSecret === undefined) {
      delete process.env.INTERNAL_APP_SIGNING_SECRET
    } else {
      process.env.INTERNAL_APP_SIGNING_SECRET = originalSecret
    }
  })

  it("calls unversioned /api/app target and signs canonical /api/app path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")

    const body = JSON.stringify({ claimToken: "token-1" })
    await fetchInternalApp("/responses/forfeit-anonymous-points", {
      method: "POST",
      body,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api:8080/api/app/responses/forfeit-anonymous-points")

    const headers = new Headers(init.headers)
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""

    expect(timestamp).not.toBe("")
    expect(signature).toBe(
      signCanonical(
        "unit-test-secret",
        "POST",
        "/api/app/responses/forfeit-anonymous-points",
        timestamp,
        body
      )
    )
  })

  it("normalizes path without leading slash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")

    await fetchInternalApp("responses/forfeit-anonymous-points", {
      method: "POST",
      body: "{}",
    })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("http://api:8080/api/app/responses/forfeit-anonymous-points")
  })

  it("keeps query in target URL but signs pathname only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")

    await fetchInternalApp("/admin/datasets?search=abc&limit=20", {
      headers: { Authorization: "Bearer t1" },
      cache: "no-store",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api:8080/api/app/admin/datasets?search=abc&limit=20")

    const headers = new Headers(init.headers)
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""

    expect(timestamp).not.toBe("")
    expect(signature).toBe(
      signCanonical(
        "unit-test-secret",
        "GET",
        "/api/app/admin/datasets",
        timestamp,
        ""
      )
    )
  })
})
