import LogtoClient from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"
import { NextRequest, NextResponse } from "next/server"

type LogtoServerClient = {
  handleSignIn: (options: { redirectUri: string }) => Promise<{ url: string }>
  handleSignOut: (baseUrl: string) => Promise<string>
  handleSignInCallback: (callbackUrl: string) => Promise<void>
}

const createClient = async () => {
  const config = await getLogtoConfig()
  const client = new LogtoClient(config) as unknown as LogtoServerClient
  return { config, client }
}

const RETURN_TO_COOKIE = "surtopya_return_to"

const sanitizeReturnTo = (value: string | null) => {
  if (!value) return null
  if (!value.startsWith("/")) return null
  return value
}

const resolveConfiguredBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  process.env.PUBLIC_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  ""

const normalizeForwardedValue = (value: string | null) => value?.split(",")[0]?.trim() || ""

const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase()
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1"
}

const resolveFallbackOrigin = (request: NextRequest) => {
  const forwardedHost = normalizeForwardedValue(request.headers.get("x-forwarded-host"))
  const forwardedProto = normalizeForwardedValue(request.headers.get("x-forwarded-proto")) || "https"
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : ""

  const configuredBaseUrl = resolveConfiguredBaseUrl()
  if (configuredBaseUrl) {
    try {
      const configuredUrl = new URL(configuredBaseUrl)
      if (forwardedOrigin && isLoopbackHostname(configuredUrl.hostname)) {
        const forwardedUrl = new URL(forwardedOrigin)
        if (!isLoopbackHostname(forwardedUrl.hostname)) {
          return forwardedUrl.origin
        }
      }
      return configuredUrl.origin
    } catch {
      // Fall through to forwarded headers.
    }
  }

  if (forwardedOrigin) {
    return forwardedOrigin
  }

  const host = normalizeForwardedValue(request.headers.get("host"))
  if (host) {
    const proto =
      normalizeForwardedValue(request.headers.get("x-forwarded-proto")) ||
      request.nextUrl.protocol.replace(":", "") ||
      "http"
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}

const createAuthErrorFallbackUrl = (request: NextRequest) => {
  const fallbackUrl = new URL("/", resolveFallbackOrigin(request))
  fallbackUrl.searchParams.set("authError", "logto_configuration")
  return fallbackUrl
}

const createCallbackUrl = (request: NextRequest, baseUrl: string) => {
  const callbackUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, baseUrl)
  return callbackUrl.toString()
}

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) => {
  try {
    const { config, client } = await createClient()
    const { action } = await params

    if (action === "sign-in") {
      const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"))
      const { url } = await client.handleSignIn({
        redirectUri: `${config.baseUrl}/api/logto/sign-in-callback`,
      })
      const response = NextResponse.redirect(url)
      if (returnTo) {
        response.cookies.set(RETURN_TO_COOKIE, encodeURIComponent(returnTo), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 10 * 60,
        })
      }
      return response
    }
    if (action === "sign-out") {
      const url = await client.handleSignOut(config.baseUrl)
      return NextResponse.redirect(url)
    }
    if (action === "sign-in-callback") {
      await client.handleSignInCallback(createCallbackUrl(request, config.baseUrl))
      const returnToRaw = request.cookies.get(RETURN_TO_COOKIE)?.value
      const returnTo = sanitizeReturnTo(returnToRaw ? decodeURIComponent(returnToRaw) : null)
      const response = NextResponse.redirect(returnTo ? new URL(returnTo, config.baseUrl) : new URL(config.baseUrl))
      response.cookies.delete(RETURN_TO_COOKIE)
      return response
    }

    return new NextResponse("Not Found", { status: 404 })
  } catch (error) {
    console.error("Logto route error:", error)
    return NextResponse.redirect(createAuthErrorFallbackUrl(request))
  }
}

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) => {
  try {
    const { config, client } = await createClient()
    const { action } = await params

    if (action === "sign-in") {
      const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"))
      const { url } = await client.handleSignIn({
        redirectUri: `${config.baseUrl}/api/logto/sign-in-callback`,
      })
      const response = NextResponse.redirect(url)
      if (returnTo) {
        response.cookies.set(RETURN_TO_COOKIE, encodeURIComponent(returnTo), {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 10 * 60,
        })
      }
      return response
    }
    if (action === "sign-out") {
      const url = await client.handleSignOut(config.baseUrl)
      return NextResponse.redirect(url)
    }

    return new NextResponse("Not Found", { status: 404 })
  } catch (error) {
    console.error("Logto route error:", error)
    return NextResponse.redirect(createAuthErrorFallbackUrl(request))
  }
}
