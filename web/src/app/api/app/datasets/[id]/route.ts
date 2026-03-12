import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await fetch(`${API_BASE_URL}/datasets/${id}`, {
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))

  return NextResponse.json(payload, { status: response.status })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = await getAuthToken()

  const response = await fetch(`${API_BASE_URL}/datasets/${id}/download`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => ({}))
    return NextResponse.json(payload, { status: response.status })
  }

  const headers = new Headers()
  const contentDisposition = response.headers.get("content-disposition")
  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition)
  }
  if (contentType) {
    headers.set("content-type", contentType)
  }

  return new NextResponse(response.body, { status: response.status, headers })
}
