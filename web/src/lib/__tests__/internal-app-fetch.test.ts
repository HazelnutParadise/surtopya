import crypto from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api-server", () => ({
  API_BASE_URL: "http://api:8080/v1",
}))

const signCanonical = (secret: string, method: string, path: string, timestamp: string, body: string) => {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex")
  const canonical = [method.toUpperCase(), path, timestamp, bodyHash].join("\n")
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex")
}

const encoder = new TextEncoder()

const signCanonicalBytes = (
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: Uint8Array
) => {
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex")
  const canonical = [method.toUpperCase(), path, timestamp, bodyHash].join("\n")
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex")
}

const bodyToBytes = async (body: BodyInit | null | undefined) => {
  if (!body) {
    return new Uint8Array()
  }
  if (typeof body === "string") {
    return encoder.encode(body)
  }
  if (body instanceof Uint8Array) {
    return body
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
  }
  if (body instanceof URLSearchParams) {
    return encoder.encode(body.toString())
  }
  const request = new Request("http://internal.surtopya.local", {
    method: "POST",
    body,
  })
  return new Uint8Array(await request.arrayBuffer())
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

  it("signs FormData with serialized multipart bytes and forwards multipart content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")

    const formData = new FormData()
    formData.append("title", "dataset alpha")
    formData.append("sampleSize", "42")

    await fetchInternalApp("/admin/datasets", {
      method: "POST",
      body: formData,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api:8080/api/app/admin/datasets")

    const headers = new Headers(init.headers)
    const contentType = headers.get("Content-Type") || ""
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""
    const bodyBytes = await bodyToBytes(init.body as BodyInit | null | undefined)

    expect(contentType).toContain("multipart/form-data")
    expect(contentType).toContain("boundary=")
    expect(bodyBytes.byteLength).toBeGreaterThan(0)
    expect(signature).toBe(
      signCanonicalBytes(
        "unit-test-secret",
        "POST",
        "/api/app/admin/datasets",
        timestamp,
        bodyBytes
      )
    )
  })

  it("signs ArrayBuffer bodies with raw bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")
    const rawBody = new Uint8Array([0, 1, 2, 250, 255]).buffer

    await fetchInternalApp("/admin/raw-upload", {
      method: "POST",
      body: rawBody,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api:8080/api/app/admin/raw-upload")

    const headers = new Headers(init.headers)
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""
    const bodyBytes = await bodyToBytes(init.body as BodyInit | null | undefined)

    expect(bodyBytes).toEqual(new Uint8Array([0, 1, 2, 250, 255]))
    expect(signature).toBe(
      signCanonicalBytes(
        "unit-test-secret",
        "POST",
        "/api/app/admin/raw-upload",
        timestamp,
        bodyBytes
      )
    )
  })

  it("serializes URLSearchParams for signing and sets form content type when missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")
    const params = new URLSearchParams({ search: "abc", limit: "20" })

    await fetchInternalApp("/admin/datasets/search", {
      method: "POST",
      body: params,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://api:8080/api/app/admin/datasets/search")

    const headers = new Headers(init.headers)
    const contentType = headers.get("Content-Type") || ""
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""
    const bodyBytes = await bodyToBytes(init.body as BodyInit | null | undefined)

    expect(contentType).toContain("application/x-www-form-urlencoded")
    expect(bodyBytes).toEqual(encoder.encode(params.toString()))
    expect(signature).toBe(
      signCanonicalBytes(
        "unit-test-secret",
        "POST",
        "/api/app/admin/datasets/search",
        timestamp,
        bodyBytes
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

  it("uses JWT_SECRET when INTERNAL_APP_SIGNING_SECRET is not set", async () => {
    if (originalSecret === undefined) {
      delete process.env.INTERNAL_APP_SIGNING_SECRET
    } else {
      process.env.INTERNAL_APP_SIGNING_SECRET = originalSecret
    }

    process.env.INTERNAL_APP_SIGNING_SECRET = ""
    process.env.JWT_SECRET = "jwt-secret-for-test"

    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { fetchInternalApp } = await import("@/lib/internal-app-fetch")

    await fetchInternalApp("/admin/check", { method: "GET" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    const timestamp = headers.get("X-Surtopya-App-Timestamp") || ""
    const signature = headers.get("X-Surtopya-App-Signature") || ""

    expect(timestamp).not.toBe("")
    expect(signature).toBe(
      signCanonical(
        "jwt-secret-for-test",
        "GET",
        "/api/app/admin/check",
        timestamp,
        ""
      )
    )

    delete process.env.JWT_SECRET
  })
})

