import { buildDatasetsOpenApiSpec } from "@/lib/datasets-openapi"
import { describe, expect, it } from "vitest"

describe("datasets openapi spec", () => {
  it("contains required top-level fields and single server from provided api url", () => {
    const spec = buildDatasetsOpenApiSpec({ publicApiUrl: "https://api.example.com/v1/" })

    expect(spec.openapi).toBe("3.1.0")
    expect(spec.info.title).toBe("Surtopya Dataset API")
    expect(spec.servers).toEqual([
      {
        url: "https://api.example.com/v1",
        description: "Versioned public API",
      },
    ])
    expect(spec.servers.some((server) => server.url === "/api/app")).toBe(false)
  })

  it("defines all dataset endpoints with parameters and responses", () => {
    const spec = buildDatasetsOpenApiSpec()

    expect(spec.paths["/datasets"]?.get).toBeDefined()
    expect(spec.paths["/datasets/categories"]?.get).toBeDefined()
    expect(spec.paths["/datasets/{id}"]?.get).toBeDefined()
    expect(spec.paths["/datasets/{id}/versions"]?.get).toBeDefined()
    expect(spec.paths["/datasets/{id}/purchase"]?.post).toBeDefined()
    expect(spec.paths["/datasets/{id}/download"]?.post).toBeDefined()

    expect(spec.paths["/datasets"]?.get?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}"]?.get?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}/versions"]?.get?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}/purchase"]?.post?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}/download"]?.post?.parameters?.length).toBeGreaterThan(0)

    expect(spec.paths["/datasets"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(spec.paths["/datasets/categories"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(spec.paths["/datasets/{id}"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(
      spec.paths["/datasets/{id}/versions"]?.get?.responses?.[200]?.content?.["application/json"]?.examples
    ).toBeDefined()
    expect(
      spec.paths["/datasets/{id}/purchase"]?.post?.responses?.[200]?.content?.["application/json"]?.examples
    ).toBeDefined()
    expect(
      spec.paths["/datasets/{id}/download"]?.post?.responses?.[200]?.content?.["application/json"]?.examples
    ).toBeDefined()
  })

  it("documents download and purchase error codes", () => {
    const spec = buildDatasetsOpenApiSpec()
    const downloadResponses = spec.paths["/datasets/{id}/download"]?.post?.responses
    const purchaseResponses = spec.paths["/datasets/{id}/purchase"]?.post?.responses

    expect(downloadResponses?.[401]?.["x-error-code"]).toBe("unauthorized")
    expect(downloadResponses?.[402]?.["x-error-code"]).toBe("purchase_required")
    expect(downloadResponses?.[404]?.["x-error-code"]).toBe("not_found")
    expect(downloadResponses?.[500]?.["x-error-code"]).toBe("server_error")

    expect(purchaseResponses?.[401]?.["x-error-code"]).toBe("unauthorized")
    expect(purchaseResponses?.[402]?.["x-error-code"]).toBe("insufficient_points")
    expect(purchaseResponses?.[404]?.["x-error-code"]).toBe("not_found")
    expect(purchaseResponses?.[500]?.["x-error-code"]).toBe("server_error")
  })
})

