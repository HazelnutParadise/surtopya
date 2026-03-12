export interface BuildDatasetsOpenApiSpecOptions {
  publicApiUrl: string
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

export const buildDatasetsOpenApiSpec = ({ publicApiUrl }: BuildDatasetsOpenApiSpecOptions) => {
  const normalizedPublicApiUrl = trimTrailingSlash(publicApiUrl)

  const servers: Array<{ url: string; description: string }> = [
    {
      url: "/api/app",
      description: "Same-origin proxy (recommended for interactive try-out)",
    },
  ]

  if (normalizedPublicApiUrl) {
    servers.push({
      url: normalizedPublicApiUrl,
      description: "Versioned public API",
    })
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Surtopya Dataset API",
      version: "1.0.0",
      description:
        "Dataset marketplace API (public, versioned). Use the same-origin proxy server in this page for authenticated try-out.",
    },
    servers,
    tags: [
      {
        name: "Datasets",
        description: "Browse dataset listings and download dataset files.",
      },
    ],
    paths: {
      "/datasets": {
        get: {
          tags: ["Datasets"],
          summary: "List datasets",
          description: "Returns dataset listings with optional filtering and sorting.",
          parameters: [
            { $ref: "#/components/parameters/AcceptLanguageHeader" },
            {
              name: "category",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter by category slug (e.g. market-research).",
              example: "market-research",
            },
            {
              name: "accessType",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["free", "paid"] },
              description: "Filter by access type.",
              example: "free",
            },
            {
              name: "search",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Keyword search for title/description.",
              example: "consumer",
            },
            {
              name: "sort",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["newest", "downloads", "samples"],
                default: "newest",
              },
              description: "Sorting strategy.",
              example: "downloads",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
              description: "Maximum number of items.",
              example: 20,
            },
            {
              name: "offset",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 0, default: 0 },
              description: "Pagination offset.",
              example: 0,
            },
          ],
          responses: {
            200: {
              description: "Dataset list returned.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DatasetListResponse" },
                  examples: {
                    success: {
                      value: {
                        datasets: [
                          {
                            id: "d94e86b5-3a22-422d-8f2b-bf79d59f18ec",
                            surveyId: "e26d72ff-5f26-4e48-8f36-c6f8208a8f74",
                            title: "Consumer Lifestyle Pulse 2026",
                            description: "De-identified responses on shopping habits.",
                            category: "market-research",
                            accessType: "free",
                            price: 0,
                            downloadCount: 132,
                            sampleSize: 1200,
                            isActive: true,
                            fileName: "consumer-lifestyle-pulse-2026.csv",
                            fileSize: 348224,
                            mimeType: "text/csv",
                            createdAt: "2026-02-05T04:00:00Z",
                            updatedAt: "2026-02-05T04:00:00Z",
                          },
                        ],
                        meta: {
                          limit: 20,
                          offset: 0,
                        },
                      },
                    },
                  },
                },
              },
            },
            500: {
              description: "Server error. error code: server_error",
              "x-error-code": "server_error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    serverError: {
                      value: {
                        error: "Failed to get datasets",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/datasets/categories": {
        get: {
          tags: ["Datasets"],
          summary: "List dataset categories",
          description: "Returns available category metadata.",
          parameters: [{ $ref: "#/components/parameters/AcceptLanguageHeader" }],
          responses: {
            200: {
              description: "Category list returned.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CategoryListResponse" },
                  examples: {
                    success: {
                      value: {
                        categories: [
                          {
                            id: "market-research",
                            name: "Market Research",
                            description: "Consumer preferences and market trends",
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            500: {
              description: "Server error. error code: server_error",
              "x-error-code": "server_error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/datasets/{id}": {
        get: {
          tags: ["Datasets"],
          summary: "Get dataset details",
          description: "Returns a single dataset by id.",
          parameters: [
            { $ref: "#/components/parameters/DatasetIdPath" },
            { $ref: "#/components/parameters/AcceptLanguageHeader" },
          ],
          responses: {
            200: {
              description: "Dataset returned.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Dataset" },
                  examples: {
                    success: {
                      value: {
                        id: "d94e86b5-3a22-422d-8f2b-bf79d59f18ec",
                        surveyId: "e26d72ff-5f26-4e48-8f36-c6f8208a8f74",
                        title: "Consumer Lifestyle Pulse 2026",
                        description: "De-identified responses on shopping habits.",
                        category: "market-research",
                        accessType: "free",
                        price: 0,
                        downloadCount: 132,
                        sampleSize: 1200,
                        isActive: true,
                        fileName: "consumer-lifestyle-pulse-2026.csv",
                        fileSize: 348224,
                        mimeType: "text/csv",
                        createdAt: "2026-02-05T04:00:00Z",
                        updatedAt: "2026-02-05T04:00:00Z",
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid dataset id. error code: invalid_dataset_id",
              "x-error-code": "invalid_dataset_id",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    invalidId: {
                      value: {
                        error: "Invalid dataset ID",
                      },
                    },
                  },
                },
              },
            },
            404: {
              description: "Dataset not found. error code: not_found",
              "x-error-code": "not_found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    notFound: {
                      value: {
                        error: "Dataset not found",
                      },
                    },
                  },
                },
              },
            },
            500: {
              description: "Server error. error code: server_error",
              "x-error-code": "server_error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    serverError: {
                      value: {
                        error: "Failed to get dataset",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/datasets/{id}/download": {
        post: {
          tags: ["Datasets"],
          summary: "Download dataset file",
          description:
            "Triggers dataset download. In this docs page, try-out is intentionally blocked for paid datasets.",
          parameters: [
            { $ref: "#/components/parameters/DatasetIdPath" },
            { $ref: "#/components/parameters/AcceptLanguageHeader" },
          ],
          responses: {
            200: {
              description: "Download stream or fallback JSON message.",
              content: {
                "text/csv": {
                  schema: { type: "string", format: "binary" },
                },
                "application/json": {
                  schema: { $ref: "#/components/schemas/DownloadJsonResponse" },
                  examples: {
                    jsonFallback: {
                      value: {
                        message: "Dataset download initiated",
                        datasetId: "d94e86b5-3a22-422d-8f2b-bf79d59f18ec",
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid dataset id. error code: invalid_dataset_id",
              "x-error-code": "invalid_dataset_id",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    invalidId: {
                      value: {
                        error: "Invalid dataset ID",
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: "Authentication required for paid dataset. error code: unauthorized",
              "x-error-code": "unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    unauthorized: {
                      value: {
                        error: "Authentication required for paid datasets",
                      },
                    },
                  },
                },
              },
            },
            402: {
              description: "Insufficient points for paid dataset. error code: insufficient_points",
              "x-error-code": "insufficient_points",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    insufficientPoints: {
                      value: {
                        error: "Insufficient points",
                      },
                    },
                  },
                },
              },
            },
            404: {
              description: "Dataset not found. error code: not_found",
              "x-error-code": "not_found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    notFound: {
                      value: {
                        error: "Dataset not found",
                      },
                    },
                  },
                },
              },
            },
            500: {
              description: "Server error. error code: server_error",
              "x-error-code": "server_error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    serverError: {
                      value: {
                        error: "Failed to process purchase",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      parameters: {
        DatasetIdPath: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Dataset id.",
          example: "d94e86b5-3a22-422d-8f2b-bf79d59f18ec",
        },
        AcceptLanguageHeader: {
          name: "Accept-Language",
          in: "header",
          required: false,
          schema: { type: "string" },
          description: "Preferred locale, e.g. zh-TW, en, ja.",
          example: "zh-TW",
        },
      },
      schemas: {
        Dataset: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "category",
            "accessType",
            "price",
            "downloadCount",
            "sampleSize",
            "isActive",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            surveyId: { type: "string", format: "uuid", nullable: true },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            category: { type: "string" },
            accessType: { type: "string", enum: ["free", "paid"] },
            price: { type: "integer" },
            downloadCount: { type: "integer" },
            sampleSize: { type: "integer" },
            isActive: { type: "boolean" },
            fileName: { type: "string", nullable: true },
            fileSize: { type: "integer", nullable: true },
            mimeType: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DatasetListResponse: {
          type: "object",
          required: ["datasets", "meta"],
          properties: {
            datasets: {
              type: "array",
              items: { $ref: "#/components/schemas/Dataset" },
            },
            meta: {
              type: "object",
              required: ["limit", "offset"],
              properties: {
                limit: { type: "integer" },
                offset: { type: "integer" },
              },
            },
          },
        },
        Category: {
          type: "object",
          required: ["id", "name", "description"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
          },
        },
        CategoryListResponse: {
          type: "object",
          required: ["categories"],
          properties: {
            categories: {
              type: "array",
              items: { $ref: "#/components/schemas/Category" },
            },
          },
        },
        DownloadJsonResponse: {
          type: "object",
          required: ["message", "datasetId"],
          properties: {
            message: { type: "string" },
            datasetId: { type: "string", format: "uuid" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }
}
