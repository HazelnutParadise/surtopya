import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  const category = searchParams.get("category")
  const accessType = searchParams.get("accessType")
  const search = searchParams.get("search")
  const sort = searchParams.get("sort")
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")

  if (category) params.set("category", category)
  if (accessType) params.set("accessType", accessType)
  if (search) params.set("search", search)
  if (sort) params.set("sort", sort)
  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)

  const url = `${API_BASE_URL}/datasets${params.toString() ? `?${params}` : ""}`
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))

  return NextResponse.json(payload, { status: response.status })
}
