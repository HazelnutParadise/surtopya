import { fetchInternalApp } from "@/lib/internal-app-fetch"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "en"

  const response = await fetchInternalApp(`/pricing/plans?locale=${encodeURIComponent(locale)}`, {
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
