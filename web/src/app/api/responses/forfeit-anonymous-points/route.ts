import { NextResponse } from "next/server"
import { fetchInternalApp } from "@/lib/internal-app-fetch"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const response = await fetchInternalApp("/responses/forfeit-anonymous-points", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
