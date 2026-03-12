import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const incomingUrl = new URL(request.url)
  const version = incomingUrl.searchParams.get("version")
  const upstreamUrl = new URL(`${API_BASE_URL}/surveys/${id}/responses/analytics`)
  if (version) {
    upstreamUrl.searchParams.set("version", version)
  }

  const response = await fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
