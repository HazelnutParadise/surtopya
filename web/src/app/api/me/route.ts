import { NextResponse } from "next/server"
import { API_BASE_URL, getAuthToken } from "@/lib/api-server"
import { getLogtoConfig } from "@/lib/logto"
import { getLogtoContext } from "@logto/next/server-actions"

type UnknownRecord = Record<string, unknown>

const getFirstText = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

const getRecordString = (record: UnknownRecord, key: string): string | null => {
  const value = record[key]
  return typeof value === "string" ? value : null
}

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    )
  }

  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))

  if (response.ok) {
    const displayName = payload?.displayName as string | undefined
    const avatarUrl = payload?.avatarUrl as string | undefined
    const email = payload?.email as string | undefined

    if (!displayName || !avatarUrl || !email) {
      try {
        const config = await getLogtoConfig()
        const context = await getLogtoContext(config, { fetchUserInfo: true })
        const info = (context.userInfo ?? {}) as UnknownRecord
        const resolvedName =
          displayName ||
          getFirstText(
            // userInfo is typed as unknown by Logto typings; cast to allow property access
            // values are passed to getFirstText which accepts unknown, so this is safe
            getRecordString(info, "name"),
            getRecordString(info, "preferred_username"),
            getRecordString(info, "nickname"),
            getRecordString(info, "username"),
            getRecordString(info, "given_name") && getRecordString(info, "family_name")
              ? `${getRecordString(info, "given_name")} ${getRecordString(info, "family_name")}`
              : undefined
          )
        const resolvedAvatar = avatarUrl || getFirstText(getRecordString(info, "picture"), getRecordString(info, "avatar"))
        const resolvedEmail = email || getFirstText(getRecordString(info, "email"))

        const updates: Record<string, string> = {}
        if (!displayName && resolvedName) updates.displayName = resolvedName
        if (!avatarUrl && resolvedAvatar) updates.avatarUrl = resolvedAvatar
        if (!email && resolvedEmail) updates.email = resolvedEmail

        if (Object.keys(updates).length > 0) {
          await fetch(`${API_BASE_URL}/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          })

          payload.displayName = resolvedName ?? payload.displayName
          payload.avatarUrl = resolvedAvatar ?? payload.avatarUrl
          payload.email = resolvedEmail ?? payload.email
        }
      } catch (error) {
        console.error("Failed to sync Logto profile:", error)
      }
    }
  }

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
