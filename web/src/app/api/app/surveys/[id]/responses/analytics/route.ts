import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

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
  const path =
    version && version.length > 0
      ? `/surveys/${id}/responses/analytics?version=${encodeURIComponent(version)}`
      : `/surveys/${id}/responses/analytics`

  const response = await fetchInternalApp(path, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
