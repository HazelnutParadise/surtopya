import { NextResponse } from "next/server"
import { getAuthToken } from "@/lib/api-server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const contentType = request.headers.get("content-type") || ""

  let response: Response
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    response = await fetchInternalApp(`/admin/datasets/${id}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  } else {
    const body = await request.json().catch(() => ({}))
    response = await fetchInternalApp(`/admin/datasets/${id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  }

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
