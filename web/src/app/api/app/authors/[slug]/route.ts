import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { ANONYMOUS_RESPONDENT_COOKIE } from "@/lib/anonymous-respondent"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const query = new URLSearchParams()
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")
  if (limit) query.set("limit", limit)
  if (offset) query.set("offset", offset)

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

  const response = await fetchInternalApp(
    `/authors/${encodeURIComponent(slug)}${query.toString() ? `?${query}` : ""}`,
    {
      cache: "no-store",
      headers: outboundHeaders,
    }
  )
  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
