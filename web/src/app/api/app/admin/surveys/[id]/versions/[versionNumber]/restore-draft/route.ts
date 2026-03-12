import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionNumber: string }> }
) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id, versionNumber } = await params
  const response = await fetch(`${API_BASE_URL}/admin/surveys/${id}/versions/${versionNumber}/restore-draft`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
