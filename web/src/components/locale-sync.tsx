"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

const localeOptions = ["zh-TW", "en", "ja"]

const getLocaleFromPath = (pathname: string) => {
  const segment = pathname.split("/").filter(Boolean)[0]
  return localeOptions.includes(segment) ? segment : "zh-TW"
}

export function LocaleSync() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let isActive = true
    const syncLocale = async () => {
      try {
        const response = await fetch("/api/user-settings", { cache: "no-store" })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (!isActive || !data?.locale) {
          return
        }
        const currentLocale = getLocaleFromPath(pathname)
        if (data.locale !== currentLocale) {
          const segments = pathname.split("/").filter(Boolean)
          const hasLocale = localeOptions.includes(segments[0])
          const rest = hasLocale ? segments.slice(1) : segments
          const nextPath = `/${data.locale}/${rest.join("/")}`.replace(/\/$/, "")
          router.replace(nextPath || `/${data.locale}`)
        }
      } catch {
        // Ignore locale sync errors for unauthenticated users
      }
    }

    syncLocale()
    return () => {
      isActive = false
    }
  }, [pathname, router])

  return null
}
