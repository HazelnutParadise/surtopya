import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

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

  const response = await fetch(`${API_BASE_URL}/drafts/${id}/answers/bulk`, {
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
