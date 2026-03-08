import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const response = await fetch(`${API_BASE_URL}/surveys/${id}/responses/submit-anonymous`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
