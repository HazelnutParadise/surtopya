import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getLogtoConfig } from "@/lib/logto"
import { getLogtoContext } from "@logto/next/server-actions"
import { CookieStorage } from "@logto/node"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    const cookieStore = await cookies()
    const appId = process.env.LOGTO_APP_ID || ""
    const cookieKey = appId ? `logto_${appId}` : ""
    const cookieValue = cookieKey ? cookieStore.get(cookieKey)?.value : undefined
    const hasLogtoCookie = Boolean(cookieValue)
    let logtoIsAuthenticated: boolean | null = null
    let logtoError: string | null = null
    let logtoSessionKeys: string[] | null = null
    let logtoSessionError: string | null = null

    try {
      const config = await getLogtoConfig()
      const context = await getLogtoContext(config)
      logtoIsAuthenticated = context.isAuthenticated
    } catch (error) {
      logtoError = String(error)
    }

    if (cookieValue && cookieKey) {
      try {
        const storage = new CookieStorage({
          encryptionKey: process.env.LOGTO_COOKIE_SECRET || "",
          cookieKey,
          isSecure: false,
          getCookie: async () => cookieValue,
          setCookie: async () => {},
        })
        await storage.init()
        logtoSessionKeys = Object.keys(storage.data || {})
      } catch (error) {
        logtoSessionError = String(error)
      }
    }

    const cookieSegments = cookieValue ? cookieValue.split(".") : []
    return NextResponse.json(
      {
        error: "unauthorized",
        has_logto_cookie: hasLogtoCookie,
        cookie_key: cookieKey,
        logto_is_authenticated: logtoIsAuthenticated,
        logto_error: logtoError,
        logto_session_keys: logtoSessionKeys,
        logto_session_error: logtoSessionError,
        logto_cookie_length: cookieValue ? cookieValue.length : 0,
        logto_cookie_prefix: cookieValue ? cookieValue.slice(0, 12) : null,
        logto_cookie_segments: cookieSegments.length,
      },
      { status: 401 }
    )
  }

  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
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
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const payload = await response.json().catch(() => ({}))
  return NextResponse.json(payload, { status: response.status })
}
