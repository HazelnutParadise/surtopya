import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

export async function GET(request: Request) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()
  const search = searchParams.get("search")
  const role = searchParams.get("role")
  const membershipTier = searchParams.get("membership_tier")
  const isDisabled = searchParams.get("is_disabled")
  const limit = searchParams.get("limit")
  const offset = searchParams.get("offset")

  if (search) params.set("search", search)
  if (role) params.set("role", role)
  if (membershipTier) params.set("membership_tier", membershipTier)
  if (isDisabled) params.set("is_disabled", isDisabled)
  if (limit) params.set("limit", limit)
  if (offset) params.set("offset", offset)

  const url = `/admin/users${params.toString() ? `?${params}` : ""}`
  const response = await fetchInternalApp(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
