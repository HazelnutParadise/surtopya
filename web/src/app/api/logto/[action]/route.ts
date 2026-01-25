import LogtoClient from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { CookieStorage } from "@logto/node"

export const GET = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    try {
        const config = await getLogtoConfig()
        const client = new LogtoClient(config) as any
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
            console.info("Logto callback: start")
            await client.handleSignInCallback(request.url)

            try {
                const cookieStore = await cookies()
                const cookieKey = `logto_${config.appId}`
                const cookieValue = cookieStore.get(cookieKey)?.value
                if (cookieValue) {
                    const storage = new CookieStorage({
                        encryptionKey: process.env.LOGTO_COOKIE_SECRET || "",
                        cookieKey,
                        isSecure: false,
                        getCookie: async () => cookieValue,
                        setCookie: async () => {},
                    })
                    await storage.init()
                    const keys = Object.keys(storage.data || {})
                    const hasIdToken = Boolean(storage.data?.idToken)
                    console.info("Logto callback: session keys", keys, "idToken", hasIdToken)
                } else {
                    console.warn("Logto callback: cookie missing")
                }
            } catch (logError) {
                console.error("Logto callback: session inspect failed", logError)
            }

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

export const POST = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    try {
        const config = await getLogtoConfig()
        const client = new LogtoClient(config) as any
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
