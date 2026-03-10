import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const outboundBody =
    body && typeof body === "object" && !Array.isArray(body) ? { ...body } : {}
  delete (outboundBody as Record<string, unknown>).anonymousId

  const response = await fetchInternalApp(`/surveys/${id}/drafts/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(outboundBody),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
