export type DatasetAccessType = "free" | "paid"

export type SwaggerRequestLike = {
  method?: string
  url?: string
  credentials?: RequestCredentials
  fetchOptions?: RequestInit
}

export interface DatasetDocsInterceptorMessages {
  invalidDownloadRequest: string
  paidDatasetBlocked: string
  datasetLookupFailed: string
}

export interface CreateDatasetDocsRequestInterceptorOptions {
  getDatasetAccessType: (datasetId: string) => Promise<DatasetAccessType | null>
  messages: DatasetDocsInterceptorMessages
  onBlocked?: (reason: string) => void
}

const DOWNLOAD_PATH_PATTERN = /\/datasets\/([^/]+)\/download\/?$/

const isDownloadPath = (pathname: string) => {
  return pathname.includes("/datasets/") && pathname.endsWith("/download")
}

const getRequestUrl = (requestUrl: string) => {
  try {
    return new URL(requestUrl, "http://localhost")
  } catch {
    return null
  }
}

export const extractDatasetIdFromDownloadUrl = (requestUrl: string) => {
  const parsedUrl = getRequestUrl(requestUrl)
  if (!parsedUrl) return null

  const match = parsedUrl.pathname.match(DOWNLOAD_PATH_PATTERN)
  if (!match?.[1]) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export const isDatasetDownloadRequest = (request: Pick<SwaggerRequestLike, "method" | "url">) => {
  if ((request.method || "").toUpperCase() !== "POST") {
    return false
  }

  if (!request.url) {
    return false
  }

  const parsedUrl = getRequestUrl(request.url)
  if (!parsedUrl) return false

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "")
  return isDownloadPath(normalizedPath)
}

const withCookieCredentials = (request: SwaggerRequestLike) => {
  request.credentials = "include"
  request.fetchOptions = {
    ...(request.fetchOptions || {}),
    credentials: "include",
  }
}

export const createDatasetDocsRequestInterceptor = ({
  getDatasetAccessType,
  messages,
  onBlocked,
}: CreateDatasetDocsRequestInterceptorOptions) => {
  return async (request: SwaggerRequestLike) => {
    withCookieCredentials(request)

    if (!isDatasetDownloadRequest(request)) {
      return request
    }

    const datasetId = request.url ? extractDatasetIdFromDownloadUrl(request.url) : null
    if (!datasetId) {
      onBlocked?.(messages.invalidDownloadRequest)
      throw new Error(messages.invalidDownloadRequest)
    }

    let accessType: DatasetAccessType | null = null
    try {
      accessType = await getDatasetAccessType(datasetId)
    } catch {
      accessType = null
    }

    if (accessType === "free") {
      return request
    }

    const reason = accessType === "paid" ? messages.paidDatasetBlocked : messages.datasetLookupFailed
    onBlocked?.(reason)
    throw new Error(reason)
  }
}

export const fetchDatasetAccessTypeForDocs = async (datasetId: string) => {
  const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}`, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json().catch(() => null)) as { accessType?: string } | null
  const accessType = payload?.accessType

  if (accessType === "free" || accessType === "paid") {
    return accessType
  }

  return null
}
