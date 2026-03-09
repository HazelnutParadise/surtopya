"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  createDatasetDocsRequestInterceptor,
  fetchDatasetAccessTypeForDocs,
  type SwaggerRequestLike,
} from "@/lib/datasets-api-docs"

interface DatasetsSwaggerUiProps {
  specUrl: string
}

type SwaggerUiInstance = {
  destroy?: () => void
}

type SwaggerUiBundle = (config: Record<string, unknown>) => SwaggerUiInstance

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUiBundle
  }
}

const SWAGGER_UI_SCRIPT_ID = "datasets-swagger-ui-script"
const SWAGGER_UI_STYLE_ID = "datasets-swagger-ui-style"
const SWAGGER_UI_BUNDLE_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
const SWAGGER_UI_STYLE_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"

const ensureSwaggerStyles = () => {
  if (document.getElementById(SWAGGER_UI_STYLE_ID)) return

  const style = document.createElement("link")
  style.id = SWAGGER_UI_STYLE_ID
  style.rel = "stylesheet"
  style.href = SWAGGER_UI_STYLE_SRC
  document.head.appendChild(style)
}

const loadSwaggerBundle = () => {
  return new Promise<SwaggerUiBundle>((resolve, reject) => {
    if (window.SwaggerUIBundle) {
      resolve(window.SwaggerUIBundle)
      return
    }

    const existingScript = document.getElementById(SWAGGER_UI_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.SwaggerUIBundle) {
          resolve(window.SwaggerUIBundle)
          return
        }

        reject(new Error("Swagger UI bundle failed to initialize"))
      })
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Swagger UI script")))
      return
    }

    const script = document.createElement("script")
    script.id = SWAGGER_UI_SCRIPT_ID
    script.src = SWAGGER_UI_BUNDLE_SRC
    script.async = true
    script.onload = () => {
      if (!window.SwaggerUIBundle) {
        reject(new Error("Swagger UI bundle failed to initialize"))
        return
      }
      resolve(window.SwaggerUIBundle)
    }
    script.onerror = () => reject(new Error("Failed to load Swagger UI script"))
    document.body.appendChild(script)
  })
}

export function DatasetsSwaggerUi({ specUrl }: DatasetsSwaggerUiProps) {
  const t = useTranslations("ApiDocs")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

  const requestInterceptor = useMemo(() => {
    return createDatasetDocsRequestInterceptor({
      getDatasetAccessType: fetchDatasetAccessTypeForDocs,
      messages: {
        invalidDownloadRequest: t("tryItBlockedInvalidDownload"),
        paidDatasetBlocked: t("tryItBlockedPaid"),
        datasetLookupFailed: t("tryItBlockedLookupFailed"),
      },
      onBlocked: (reason) => setBlockedMessage(reason),
    })
  }, [t])

  useEffect(() => {
    let mounted = true
    let swaggerInstance: SwaggerUiInstance | null = null

    const mountSwagger = async () => {
      setLoadError(null)
      ensureSwaggerStyles()

      try {
        const SwaggerUIBundle = await loadSwaggerBundle()
        if (!mounted) return

        swaggerInstance = SwaggerUIBundle({
          url: specUrl,
          dom_id: "#datasets-swagger-ui",
          deepLinking: true,
          displayRequestDuration: true,
          defaultModelsExpandDepth: 1,
          docExpansion: "list",
          tryItOutEnabled: true,
          filter: true,
          requestInterceptor: (request: SwaggerRequestLike) => requestInterceptor(request),
        })
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : t("swaggerLoadFailed")
        setLoadError(message)
      }
    }

    mountSwagger()

    return () => {
      mounted = false
      swaggerInstance?.destroy?.()
    }
  }, [requestInterceptor, specUrl, t])

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("swaggerLoadFailed")}: {loadError}
        </div>
      ) : null}

      {blockedMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {blockedMessage}
        </div>
      ) : null}

      <div id="datasets-swagger-ui" className="overflow-hidden rounded-xl border border-gray-200 bg-white" />
    </div>
  )
}
