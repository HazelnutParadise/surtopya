import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { ANONYMOUS_RESPONDENT_COOKIE } from "@/lib/anonymous-respondent"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")
  const sort = searchParams.get("sort")

  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)
  if (sort) params.set("sort", sort)

  const token = await getAuthToken()
  const cookieStore = await cookies()
  const anonymousId = cookieStore.get(ANONYMOUS_RESPONDENT_COOKIE)?.value?.trim()
  const outboundHeaders =
    token || anonymousId
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(anonymousId ? { "X-Surtopya-Anonymous-Id": anonymousId } : {}),
        }
      : undefined

  const url = `/surveys/public${params.toString() ? `?${params}` : ""}`
  const response = await fetchInternalApp(url, {
    cache: "no-store",
    headers: outboundHeaders,
  })
  const payload = await response.json().catch(() => ({}))

  return NextResponse.json(payload, { status: response.status })
}
