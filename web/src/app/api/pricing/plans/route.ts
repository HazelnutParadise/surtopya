import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/api-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "en"

  const response = await fetch(`${API_BASE_URL}/pricing/plans?locale=${encodeURIComponent(locale)}`, {
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
