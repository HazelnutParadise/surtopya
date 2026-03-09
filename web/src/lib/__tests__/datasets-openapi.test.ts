import { buildDatasetsOpenApiSpec } from "@/lib/datasets-openapi"

describe("datasets openapi spec", () => {
  it("contains required top-level fields and servers", () => {
    const spec = buildDatasetsOpenApiSpec({ publicApiUrl: "https://api.example.com/api/v1/" })

    expect(spec.openapi).toBe("3.1.0")
    expect(spec.info.title).toBe("Surtopya Dataset API")
    expect(spec.servers).toEqual([
      {
        url: "/api",
        description: "Same-origin proxy (recommended for interactive try-out)",
      },
      {
        url: "https://api.example.com/api/v1",
        description: "Versioned public API",
      },
    ])
  })

  it("defines all dataset endpoints with parameters and responses", () => {
    const spec = buildDatasetsOpenApiSpec({ publicApiUrl: "" })

    expect(spec.paths["/datasets"]?.get).toBeDefined()
    expect(spec.paths["/datasets/categories"]?.get).toBeDefined()
    expect(spec.paths["/datasets/{id}"]?.get).toBeDefined()
    expect(spec.paths["/datasets/{id}/download"]?.post).toBeDefined()

    expect(spec.paths["/datasets"]?.get?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}"]?.get?.parameters?.length).toBeGreaterThan(0)
    expect(spec.paths["/datasets/{id}/download"]?.post?.parameters?.length).toBeGreaterThan(0)

    expect(spec.paths["/datasets"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(spec.paths["/datasets/categories"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(spec.paths["/datasets/{id}"]?.get?.responses?.[200]?.content?.["application/json"]?.examples).toBeDefined()
    expect(
      spec.paths["/datasets/{id}/download"]?.post?.responses?.[200]?.content?.["application/json"]?.examples
    ).toBeDefined()
  })

  it("documents download error codes", () => {
    const spec = buildDatasetsOpenApiSpec({ publicApiUrl: "" })
    const downloadResponses = spec.paths["/datasets/{id}/download"]?.post?.responses

    expect(downloadResponses?.[401]?.["x-error-code"]).toBe("unauthorized")
    expect(downloadResponses?.[402]?.["x-error-code"]).toBe("insufficient_points")
    expect(downloadResponses?.[404]?.["x-error-code"]).toBe("not_found")
    expect(downloadResponses?.[500]?.["x-error-code"]).toBe("server_error")
  })
})
