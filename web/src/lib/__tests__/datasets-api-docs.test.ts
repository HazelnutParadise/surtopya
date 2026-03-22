import {
  createDatasetDocsRequestInterceptor,
  isDatasetDownloadRequest,
  extractDatasetIdFromDownloadUrl,
} from "@/lib/datasets-api-docs"
import { describe, expect, it } from "vitest"

const messages = {
  invalidDownloadRequest: "invalid",
  paidDatasetBlocked: "paid",
  datasetLookupFailed: "lookup-failed",
}

describe("dataset docs interceptor", () => {
  it("detects dataset download URL and extracts dataset id", () => {
    expect(extractDatasetIdFromDownloadUrl("/api/app/datasets/abc-123/download")).toBe("abc-123")
    expect(extractDatasetIdFromDownloadUrl("https://example.com/api/app/datasets/abc-123/download")).toBe("abc-123")
    expect(extractDatasetIdFromDownloadUrl("/api/app/datasets/abc-123")).toBeNull()

    expect(
      isDatasetDownloadRequest({
        method: "POST",
        url: "/api/app/datasets/abc-123/download",
      })
    ).toBe(true)

    expect(
      isDatasetDownloadRequest({
        method: "GET",
        url: "/api/app/datasets/abc-123/download",
      })
    ).toBe(false)
  })

  it("allows download request for free dataset and forces include credentials", async () => {
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => "free",
      messages,
    })

    const request = {
      method: "POST",
      url: "/api/app/datasets/free-id/download",
    }

    const result = await interceptor(request)

    expect(result.credentials).toBe("include")
    expect(result.fetchOptions?.credentials).toBe("include")
  })

  it("blocks paid dataset download", async () => {
    const blocked: string[] = []
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => "paid",
      messages,
      onBlocked: (reason) => blocked.push(reason),
    })

    await expect(
      interceptor({
        method: "POST",
        url: "/api/app/datasets/paid-id/download",
      })
    ).rejects.toThrow("paid")

    expect(blocked).toEqual(["paid"])
  })

  it("blocks when dataset lookup fails", async () => {
    const blocked: string[] = []
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => null,
      messages,
      onBlocked: (reason) => blocked.push(reason),
    })

    await expect(
      interceptor({
        method: "POST",
        url: "/api/app/datasets/unknown/download",
      })
    ).rejects.toThrow("lookup-failed")

    expect(blocked).toEqual(["lookup-failed"])
  })

  it("blocks malformed download requests", async () => {
    const blocked: string[] = []
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => "free",
      messages,
      onBlocked: (reason) => blocked.push(reason),
    })

    await expect(
      interceptor({
        method: "POST",
        url: "/api/app/datasets//download",
      })
    ).rejects.toThrow("invalid")

    expect(blocked).toEqual(["invalid"])
  })

  it("does not block non-download endpoints", async () => {
    let calls = 0
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => {
        calls += 1
        return "free"
      },
      messages,
    })

    const request = {
      method: "GET",
      url: "/api/app/datasets",
    }

    const result = await interceptor(request)

    expect(calls).toBe(0)
    expect(result.credentials).toBe("include")
  })
})
