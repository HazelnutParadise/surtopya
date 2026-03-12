import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { ANONYMOUS_RESPONDENT_COOKIE } from "@/lib/anonymous-respondent"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const response = await fetchInternalApp(`/surveys/${id}`, {
    headers: outboundHeaders,
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const response = await fetchInternalApp(`/surveys/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const response = await fetchInternalApp(`/surveys/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
