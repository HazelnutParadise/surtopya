import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")

  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)

  const url = `${API_BASE_URL}/surveys/public${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))

  return NextResponse.json(payload, { status: response.status })
}
