import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function GET(request: Request) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  const search = searchParams.get("search")
  const active = searchParams.get("active")
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")

  if (search) params.set("search", search)
  if (active) params.set("active", active)
  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)

  const url = `${API_BASE_URL}/admin/datasets${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
