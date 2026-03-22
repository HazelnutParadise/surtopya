import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()
  const incoming = new URL(request.url)
  const versionNumber = incoming.searchParams.get("version_number")
  const query = versionNumber
    ? `?version_number=${encodeURIComponent(versionNumber)}`
    : ""

  const response = await fetch(`${API_BASE_URL}/datasets/${id}/purchase${query}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
