import LogtoClient from "@logto/next/server-actions"
import { getLogtoConfig } from "@/lib/logto"
import { NextRequest, NextResponse } from "next/server"

export const GET = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    try {
        const config = getLogtoConfig()
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
            await client.handleSignInCallback(request.url)
            return NextResponse.redirect(config.baseUrl)
        }

        return new NextResponse("Not Found", { status: 404 })
    } catch (error) {
        return NextResponse.json({ error: "Logto configuration error" }, { status: 500 })
    }
}

export const POST = async (request: NextRequest, { params }: { params: Promise<{ action: string }> }) => {
    try {
        const config = getLogtoConfig()
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
        return NextResponse.json({ error: "Logto configuration error" }, { status: 500 })
    }
}
