import { getLogtoContext } from "@logto/next/server-actions"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getLogtoConfig } from "@/lib/logto"

const DASHBOARD_FALLBACK_RETURN_TO = "/dashboard"

const toSafeReturnTo = (value: string | null) => {
  if (!value) return DASHBOARD_FALLBACK_RETURN_TO
  if (!value.startsWith("/") || value.startsWith("//")) return DASHBOARD_FALLBACK_RETURN_TO
  return value
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let isAuthenticated = false

  try {
    const config = await getLogtoConfig()
    const context = await getLogtoContext(config)
    isAuthenticated = context.isAuthenticated
  } catch {
    isAuthenticated = false
  }

  if (!isAuthenticated) {
    const headerStore = await headers()
    const returnTo = toSafeReturnTo(headerStore.get("x-return-to"))
    redirect(`/api/logto/sign-in?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return <>{children}</>
}
