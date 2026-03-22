import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await fetch(`${API_BASE_URL}/datasets/${id}/versions`, {
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
