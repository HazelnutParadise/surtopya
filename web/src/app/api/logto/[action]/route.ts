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

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) => {
  try {
    const { config, client } = await createClient()
    const { action } = await params

    if (action === "sign-in") {
      const { url } = await client.handleSignIn({
        redirectUri: `${config.baseUrl}/api/logto/sign-in-callback`,
      })
      return NextResponse.redirect(url)
    }
    if (action === "sign-out") {
      const url = await client.handleSignOut(config.baseUrl)
      return NextResponse.redirect(url)
    }
    if (action === "sign-in-callback") {
      await client.handleSignInCallback(request.url)
      return NextResponse.redirect(config.baseUrl)
    }

    return new NextResponse("Not Found", { status: 404 })
  } catch (error) {
    console.error("Logto route error:", error)
    return NextResponse.json(
      { error: "Logto configuration error", details: String(error) },
      { status: 500 }
    )
  }
}

export const POST = async (
  _request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) => {
  try {
    const { config, client } = await createClient()
    const { action } = await params

    if (action === "sign-in") {
      const { url } = await client.handleSignIn({
        redirectUri: `${config.baseUrl}/api/logto/sign-in-callback`,
      })
      return NextResponse.redirect(url)
    }
    if (action === "sign-out") {
      const url = await client.handleSignOut(config.baseUrl)
      return NextResponse.redirect(url)
    }

    return new NextResponse("Not Found", { status: 404 })
  } catch (error) {
    console.error("Logto route error:", error)
    return NextResponse.json(
      { error: "Logto configuration error", details: String(error) },
      { status: 500 }
    )
  }
}
