import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function GET() {
  const response = await fetch(`${API_BASE_URL}/datasets/categories`, {
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))

  return NextResponse.json(payload, { status: response.status })
}
