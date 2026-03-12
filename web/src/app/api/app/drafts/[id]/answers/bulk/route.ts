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

  const bodyText = await request.text()
  let body: unknown = {}
  if (bodyText.trim().length > 0) {
    try {
      body = JSON.parse(bodyText)
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 })
    }
  }

  const response = await fetchInternalApp(`/drafts/${id}/answers/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
