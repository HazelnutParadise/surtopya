import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function POST(request: Request) {
  const token = await getAuthToken()
  const body = await request.json().catch(() => ({}))

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/ui-events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
