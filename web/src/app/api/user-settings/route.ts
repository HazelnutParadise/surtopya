import { NextResponse } from "next/server"
import { getAccessToken, getLogtoContext } from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"

const API_BASE_URL = process.env.PUBLIC_API_URL || "http://localhost:8080/api/v1"

const getAuthToken = async () => {
  try {
    const config = await getLogtoConfig()
    const context = await getLogtoContext(config)
    if (!context.isAuthenticated) {
      return null
    }
    return getAccessToken(config)
  } catch (error) {
    console.error("Logto config error:", error)
    return null
  }
}

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const response = await fetch(`${API_BASE_URL}/me/settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}

export async function PATCH(request: Request) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const response = await fetch(`${API_BASE_URL}/me/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
