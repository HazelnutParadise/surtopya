import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

export async function GET(request: Request) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const incoming = new URL(request.url)
  const params = new URLSearchParams()
  const limit = incoming.searchParams.get("limit")
  const offset = incoming.searchParams.get("offset")
  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)

  const path = `/admin/deid/reviews${params.toString() ? `?${params}` : ""}`
  const response = await fetchInternalApp(path, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
