import {
  createDatasetDocsRequestInterceptor,
  isDatasetDownloadRequest,
  extractDatasetIdFromDownloadUrl,
  rewriteDatasetDocsRequestUrl,
} from "@/lib/datasets-api-docs"
import { describe, expect, it } from "vitest"

const messages = {
  invalidDownloadRequest: "invalid",
  paidDatasetBlocked: "paid",
  datasetLookupFailed: "lookup-failed",
}

describe("dataset docs interceptor", () => {
  it("rewrites versioned dataset URLs to same-origin /api/app path", () => {
    expect(rewriteDatasetDocsRequestUrl("https://api.surtopya.com/v1/datasets")).toBe("/api/app/datasets")
    expect(rewriteDatasetDocsRequestUrl("https://api.surtopya.com/v1/datasets?limit=20&offset=40")).toBe(
      "/api/app/datasets?limit=20&offset=40"
    )
    expect(rewriteDatasetDocsRequestUrl("https://api.surtopya.com/v1/datasets/abc/download?version_number=2")).toBe(
      "/api/app/datasets/abc/download?version_number=2"
    )
    expect(rewriteDatasetDocsRequestUrl("/api/v1/datasets/categories")).toBe("/api/app/datasets/categories")
    expect(rewriteDatasetDocsRequestUrl("/api/docs/datasets/openapi.json")).toBe("/api/docs/datasets/openapi.json")
  })

  it("detects dataset download URL and extracts dataset id", () => {
    expect(extractDatasetIdFromDownloadUrl("/api/app/datasets/abc-123/download")).toBe("abc-123")
    expect(extractDatasetIdFromDownloadUrl("https://example.com/api/app/datasets/abc-123/download")).toBe("abc-123")
    expect(extractDatasetIdFromDownloadUrl("https://api.surtopya.com/v1/datasets/abc-123/download")).toBe("abc-123")
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
      url: "https://api.surtopya.com/v1/datasets?limit=10",
    }

    const result = await interceptor(request)

    expect(calls).toBe(0)
    expect(result.credentials).toBe("include")
    expect(result.url).toBe("/api/app/datasets?limit=10")
  })

  it("does not rewrite non-dataset requests", async () => {
    const interceptor = createDatasetDocsRequestInterceptor({
      getDatasetAccessType: async () => "free",
      messages,
    })

    const request = {
      method: "GET",
      url: "/api/docs/datasets/openapi.json",
    }

    const result = await interceptor(request)

    expect(result.url).toBe("/api/docs/datasets/openapi.json")
  })
})
